import React from 'react';
import TestRenderer from 'react-test-renderer';
import { formatMoney, money } from '@roundpay/shared';
import { Money } from '../Money';
import { host } from '../../test/host';

describe('Money formatting helper', () => {
  it('formats integer UGX with grouping for en locale', () => {
    expect(formatMoney(money(250_000), 'UGX', 'en')).toBe('UGX 250,000');
  });

  it('uses USh prefix in Luganda locale', () => {
    expect(formatMoney(money(1_500), 'UGX', 'lg')).toBe('USh 1,500');
  });

  it('formats zero', () => {
    expect(formatMoney(money(0), 'UGX', 'en')).toBe('UGX 0');
  });
});

describe('<Money/>', () => {
  it('renders the formatted amount inside a Text node', () => {
    const r = TestRenderer.create(<Money amount={250_000} />);
    const text = host(r.root).findByType('Text');
    expect(text.children).toContain('UGX 250,000');
  });
});
