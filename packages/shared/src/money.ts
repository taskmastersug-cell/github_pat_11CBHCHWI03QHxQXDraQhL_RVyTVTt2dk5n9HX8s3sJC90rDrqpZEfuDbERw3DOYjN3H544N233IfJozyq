// Money in RoundPay is integer minor units. For UGX there are no subunits, so
// 1 unit == 1 UGX. We brand the type so it can't be confused with a plain
// number that hasn't been validated for safe-integer range.

declare const moneyBrand: unique symbol;
export type Money = number & { readonly [moneyBrand]: true };

export type CurrencyCode = 'UGX' | 'KES' | 'TZS';

export function money(value: number): Money {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`money(${value}) is not a safe integer`);
  }
  return value as Money;
}

export const ZERO: Money = money(0);

export function addMoney(a: Money, b: Money): Money {
  return money(a + b);
}

export function subMoney(a: Money, b: Money): Money {
  return money(a - b);
}

export function negMoney(a: Money): Money {
  return money(-a);
}

export function sumMoney(values: readonly Money[]): Money {
  let acc = 0;
  for (const v of values) acc += v;
  return money(acc);
}

export function formatMoney(value: Money, currency: CurrencyCode, locale: 'en' | 'lg'): string {
  // Minimal Phase 1 formatter. Real i18n in mobile/admin via Intl.
  const grouped = value.toLocaleString(locale === 'lg' ? 'en-UG' : 'en-UG');
  switch (currency) {
    case 'UGX': return locale === 'lg' ? `USh ${grouped}` : `UGX ${grouped}`;
    case 'KES': return `KSh ${grouped}`;
    case 'TZS': return `TSh ${grouped}`;
  }
}
