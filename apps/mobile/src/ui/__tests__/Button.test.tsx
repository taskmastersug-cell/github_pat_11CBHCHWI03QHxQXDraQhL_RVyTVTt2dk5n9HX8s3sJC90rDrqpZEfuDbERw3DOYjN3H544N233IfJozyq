import React from 'react';
import TestRenderer, { ReactTestInstance } from 'react-test-renderer';
import { Button } from '../Button';
import { host } from '../../test/host';

function findByText(tree: ReactTestInstance, text: string): ReactTestInstance | null {
  let found: ReactTestInstance | null = null;
  tree.findAll((node) => {
    if (found) return false;
    if (String(node.type) === 'Text' && node.children.includes(text)) found = node;
    return false;
  });
  return found;
}

describe('<Button/>', () => {
  it('renders its label', () => {
    const r = TestRenderer.create(<Button label="Send code" onPress={() => {}} />);
    expect(findByText(r.root, 'Send code')).not.toBeNull();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const r = TestRenderer.create(<Button label="Tap me" onPress={onPress} />);
    host(r.root).findByType('Pressable').props['onPress']();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('marks Pressable disabled when disabled prop is set', () => {
    const onPress = jest.fn();
    const r = TestRenderer.create(<Button label="Off" onPress={onPress} disabled />);
    expect(host(r.root).findByType('Pressable').props['disabled']).toBe(true);
  });

  it('marks Pressable disabled when loading prop is set', () => {
    const onPress = jest.fn();
    const r = TestRenderer.create(<Button label="Wait" onPress={onPress} loading />);
    expect(host(r.root).findByType('Pressable').props['disabled']).toBe(true);
  });

  it('renders an ActivityIndicator while loading', () => {
    const r = TestRenderer.create(<Button label="Loading..." onPress={() => {}} loading />);
    expect(host(r.root).findAllByType('ActivityIndicator').length).toBe(1);
  });
});
