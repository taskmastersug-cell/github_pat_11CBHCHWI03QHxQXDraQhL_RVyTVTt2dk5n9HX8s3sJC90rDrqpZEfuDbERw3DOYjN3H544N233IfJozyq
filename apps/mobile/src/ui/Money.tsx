import React from 'react';
import { Text, TextStyle } from 'react-native';
import { formatMoney, money, type CurrencyCode } from '@roundpay/shared';
import { i18n } from '../i18n';

type Props = { amount: number; currency?: CurrencyCode; style?: TextStyle };

export function Money({ amount, currency = 'UGX', style }: Props) {
  const locale = (i18n.language === 'lg' ? 'lg' : 'en') as 'en' | 'lg';
  return <Text style={style}>{formatMoney(money(amount), currency, locale)}</Text>;
}
