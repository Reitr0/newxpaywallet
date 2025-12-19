// src/components/common/VText.js
import React from 'react';
import { Text } from 'react-native';
import clsx from 'clsx';

/**
 * VText
 *
 * Usage:
 * <VText variant="title">Heading</VText>
 * <VText variant="body" className="mt-2">Regular text</VText>
 * <VText variant="muted">Muted description</VText>
 *
 * @param {Object} props
 * @param {'title'|'body'|'muted'|'link'|'inverse'|'number'} props.variant
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 */
export default function VText({ variant = 'body', className = '', children, ...props }) {
  const variantClasses = {
    title: 'text-title text-lg font-bold',
    body: 'text-body',
    muted: 'text-muted text-sm',
    link: 'text-link text-base font-medium',
    inverse: 'text-inverse text-base',
    number: 'text-number font-mono',
  };

  return (
    <Text
      {...props}
      className={clsx(variantClasses[variant], className)}
    >
      {children}
    </Text>
  );
}
