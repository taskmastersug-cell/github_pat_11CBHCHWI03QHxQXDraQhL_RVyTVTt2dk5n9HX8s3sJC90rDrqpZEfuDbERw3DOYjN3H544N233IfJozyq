import React from 'react';
import TestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { Screen } from '../Screen';
import { host } from '../../test/host';

describe('<Screen/>', () => {
  it('renders its children', () => {
    const r = TestRenderer.create(
      <Screen>
        <Text>hello</Text>
      </Screen>,
    );
    const texts = host(r.root).findAllByType('Text').map((n) => n.children.join(''));
    expect(texts).toContain('hello');
  });

  it('uses a ScrollView body by default', () => {
    const r = TestRenderer.create(<Screen><Text>x</Text></Screen>);
    expect(host(r.root).findAllByType('ScrollView').length).toBe(1);
  });

  it('uses a plain View body when scroll is false', () => {
    const r = TestRenderer.create(<Screen scroll={false}><Text>x</Text></Screen>);
    expect(host(r.root).findAllByType('ScrollView').length).toBe(0);
  });
});
