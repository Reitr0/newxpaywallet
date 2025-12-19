// src/features/currency/state/currencyStore.js
import { proxy } from 'valtio';
import { useSnapshot } from 'valtio/react';

export const platformStore = proxy({
  fee : {
    ethereum: {
      receiver: '0xBa47cbFdD61029833841fcaA2ec2591dDfa87e51',
      percent: '1'
    },
    bsc: {
      receiver: '0xBa47cbFdD61029833841fcaA2ec2591dDfa87e51',
      percent: '1'
    },
    polygon: {
      receiver: '0xBa47cbFdD61029833841fcaA2ec2591dDfa87e51',
      percent: '1'
    },
    solana: {
      receiver: 'EHtRhXkNf2x3q1C6zTXKbyjQg7hGhE7BGPS58zfXkAoG',
      percent: '1'
    },
    tron: {
      receiver: 'TS635dt1ubqMLpiDaYwAxEzFE8mbVshMVk',
      percent: '1'
    },
    bitcoin: {
      receiver: 'bc1qwzrryqr3ja8w7hnja2spmkgfdcgvqwp5swz4af4ngsjecfz0w0pqud7k38',
      percent: '1'
    }
  }

});

/** React hook */
export function usePlatform() {
  return useSnapshot(platformStore);
}
