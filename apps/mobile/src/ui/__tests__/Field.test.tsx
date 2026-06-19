import React from 'react';
import TestRenderer from 'react-test-renderer';
import { Field } from '../Field';
import { host } from '../../test/host';

describe('<Field/>', () => {
  it('renders the label', () => {
    const r = TestRenderer.create(<Field label="Phone" value="" onChangeText={() => {}} />);
    const labels = host(r.root).findAllByType('Text').map((n) => n.children.join(''));
    expect(labels).toContain('Phone');
  });

  it('does not render an error line when error is undefined', () => {
    const r = TestRenderer.create(<Field label="Phone" value="" onChangeText={() => {}} />);
    const texts = host(r.root).findAllByType('Text').map((n) => n.children.join(''));
    expect(texts).toEqual(['Phone']);
  });

  it('renders the error text when error is provided', () => {
    const r = TestRenderer.create(
      <Field label="Phone" value="" onChangeText={() => {}} error="Bad number" />,
    );
    const texts = host(r.root).findAllByType('Text').map((n) => n.children.join(''));
    expect(texts).toContain('Bad number');
  });

  it('forwards onChangeText to the TextInput', () => {
    const onChangeText = jest.fn();
    const r = TestRenderer.create(<Field label="Phone" value="" onChangeText={onChangeText} />);
    host(r.root).findByType('TextInput').props['onChangeText']('+256700000000');
    expect(onChangeText).toHaveBeenCalledWith('+256700000000');
  });
});
