// Minimal react-native stub for unit tests. We mount components with
// @testing-library/react-native (which uses react-test-renderer), so we only
// need lightweight host components — no native bridge.

const React = require('react');

function host(name) {
  return React.forwardRef(function (props, ref) {
    return React.createElement(name, { ref, ...props });
  });
}

const View = host('View');
const Text = host('Text');
const ScrollView = host('ScrollView');
const Image = host('Image');
const TextInput = host('TextInput');
const ActivityIndicator = host('ActivityIndicator');
const KeyboardAvoidingView = host('KeyboardAvoidingView');
const FlatList = ({ data = [], keyExtractor, renderItem, ...rest }) =>
  React.createElement(
    'FlatList',
    rest,
    (data ?? []).map((item, index) =>
      renderItem ? React.cloneElement(renderItem({ item, index }), {
        key: keyExtractor ? keyExtractor(item, index) : String(index),
      }) : null,
    ),
  );

function Pressable({ onPress, disabled, children, ...rest }) {
  return React.createElement(
    'Pressable',
    {
      ...rest,
      onClick: () => { if (!disabled && onPress) onPress(); },
      onPress: () => { if (!disabled && onPress) onPress(); },
      disabled: !!disabled,
    },
    typeof children === 'function' ? children({ pressed: false }) : children,
  );
}

const StyleSheet = {
  create: (s) => s,
  flatten: (s) => s,
  absoluteFillObject: {},
  hairlineWidth: 1,
};

const Platform = {
  OS: 'ios',
  select: (obj) => obj.ios ?? obj.default ?? obj.native,
  Version: 0,
};

module.exports = {
  View,
  Text,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
};
