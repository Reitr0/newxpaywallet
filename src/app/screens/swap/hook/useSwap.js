// src/features/swap/hooks/useSwap.js
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseUnits } from 'ethers';
import { walletStore } from '@features/wallet/state/walletStore';
import { swapService } from '@features/swap/service/swapService';
import useSwapTokenList from '@src/app/screens/swap/hook/useSwapTokenList';

const toNum = (x, f=0)=> Number.isFinite(+x) ? +x : f;

export function useSwap({ initialChain='ethereum', slippageBps=160, debounceMs=350 } = {}) {
  const [chain, setChain] = useState(initialChain);
  const { list: tokenList, defaultFrom, defaultTo } = useSwapTokenList({ chain });

  const [fromToken, setFromToken] = useState(null);
  const [toToken, setToToken]     = useState(null);
  const [amount, setAmount]       = useState('');

  const [price, setPrice]     = useState(null);   // indicative (/price)
  const [quote, setQuote]     = useState(null);   // firm (/quote)
  const [pricing, setPricing] = useState(false);  // <-- NEW: spinner for /price
  const [quoting, setQuoting] = useState(false);
  const [executing, setExec]  = useState(false);
  const [error, setError]     = useState(null);

  const takerAddress = useMemo(() => {
    try { return walletStore.getWalletAddressByChain?.call(walletStore, chain); } catch { return undefined; }
  }, [chain]);

  const keyOf = (t)=> (t?.address?.toLowerCase()) || (t?.symbol?.toUpperCase()) || null;

  // balances
  const fromBalance = useMemo(()=> {
    if (!fromToken) return 0;
    const k = keyOf(fromToken);
    const t = tokenList.find(x=> keyOf(x)===k);
    return toNum(t?.balanceNum, 0);
  }, [tokenList, fromToken]);

  // base units
  const amountBaseUnits = useMemo(()=> {
    if (!fromToken) return null;
    try { return parseUnits(String(toNum(amount,0)), Number(fromToken?.decimals ?? 18)).toString(); }
    catch { return null; }
  }, [amount, fromToken]);

  // guards
  const canQuote = useMemo(()=> {
    const a = toNum(amount);
    return !!fromToken && !!toToken && keyOf(fromToken)!==keyOf(toToken) && a>0 && !!takerAddress;
  }, [fromToken, toToken, amount, takerAddress]);

  // ---- Seed defaults once they are available (mount) ----
  useEffect(() => {
    if (!fromToken && defaultFrom) setFromToken(defaultFrom);
    if (!toToken && defaultTo) setToToken(defaultTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultFrom, defaultTo]);

  // ---- Reset pair when chain changes ----
  useEffect(() => {
    if (defaultFrom && defaultTo) {
      setFromToken(defaultFrom);
      setToToken(defaultTo);
      setAmount('');
      setPrice(null);
      setQuote(null);
      setError(null);
    }
  }, [chain, defaultFrom, defaultTo]);

  // ---- Indicative /price (debounced) ----
  const ridRef = useRef(0); const debRef = useRef(null);

  const fetchPrice = useCallback(async (rid) => {
    try {
      setError(null);
      setPricing(true); // <-- start spinner
      const res = await swapService.price({
        chain, fromToken, toToken, amountBaseUnits, slippageBps, takerAddress
      });
      if (ridRef.current===rid) setPrice(res?.error ? null : res);
    } catch(e) {
      if (ridRef.current===rid) setPrice(null);
    } finally {
      if (ridRef.current===rid) setPricing(false); // <-- stop spinner
    }
  }, [chain, fromToken, toToken, amountBaseUnits, slippageBps, takerAddress]);

  useEffect(()=> {
    if (debRef.current) clearTimeout(debRef.current);
    setQuote(null); // invalidate firm quote on input change
    if (!canQuote || !amountBaseUnits) { setPrice(null); setPricing(false); return; }
    const myId = ++ridRef.current;
    debRef.current = setTimeout(()=> fetchPrice(myId), debounceMs);
    return ()=> debRef.current && clearTimeout(debRef.current);
  }, [canQuote, amountBaseUnits, chain, fromToken, toToken, debounceMs, fetchPrice]);

  // ---- Full submit: /quote -> approve? -> swap ----
  const submit = useCallback(async ()=>{
    if (!canQuote || !amountBaseUnits) return null;
    setQuoting(true); setError(null);
    try {
      const q = await swapService.quote({ chain, fromToken, toToken, amountBaseUnits, slippageBps, takerAddress });
      setQuote(q?.canSwap ? q : null);
      setQuoting(false);
      if (!q?.canSwap) { setError(q?.error || 'Quote failed'); return null; }

      // ERC-20 approval (skip for native)
      const isNative = !fromToken?.address || fromToken.address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      if (q.needApproval && q.allowanceTarget && !isNative) {
        setExec(true);
        await swapService.executeApprove({
          chain,
          fromAddress: takerAddress,
          token: fromToken,
          spender: q.allowanceTarget,
          amount: q.sellAmount,
        });
        setExec(false);

        // re-quote (state changed)
        setQuoting(true);
        const q2 = await swapService.quote({ chain, fromToken, toToken, amountBaseUnits, slippageBps, takerAddress });
        setQuote(q2?.canSwap ? q2 : null);
        setQuoting(false);
        if (!q2?.canSwap) { setError(q2?.error || 'Quote failed'); return null; }

        setExec(true);
        const receipt2 = await swapService.executeSwap({ chain, fromAddress: takerAddress, quote: q2 });
        setExec(false);
        return receipt2;
      }

      // no approval needed → swap
      setExec(true);
      const receipt = await swapService.executeSwap({ chain, fromAddress: takerAddress, quote: q });
      setExec(false);
      return receipt;
    } catch(e) {
      setError(e?.message || String(e));
      setQuoting(false); setExec(false);
      return null;
    }
  }, [canQuote, amountBaseUnits, chain, fromToken, toToken, slippageBps, takerAddress]);

  return {
    state: {
      chain, tokenList,
      fromToken, toToken, amount,
      fromBalance,
      indicative: price,
      quote,
      pricing,            // <-- expose for UI spinners
      quoting,
      executing,
      error,
      canQuote,
      canSwap: canQuote && toNum(amount) <= toNum(fromBalance),
      needApproval: Boolean(quote?.needApproval),
      allowanceTarget: quote?.allowanceTarget || price?.allowanceTarget || null,
    },
    actions: {
      setChain, setFromToken, setToToken, setAmount,
      submit,
    },
  };
}

export default useSwap;
