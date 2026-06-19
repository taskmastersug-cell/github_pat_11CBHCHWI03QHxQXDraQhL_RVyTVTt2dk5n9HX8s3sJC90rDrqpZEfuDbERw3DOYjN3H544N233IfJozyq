import type { ReactTestInstance } from 'react-test-renderer';

// react-test-renderer's findByType/findAllByType is typed to accept
// ElementType, but at runtime it happily matches on a host-element string
// (e.g. 'Text', 'View'). Our mocked react-native exports host elements
// as strings, so all our component tests need that path.
type Finder = {
  findByType: (type: string) => ReactTestInstance;
  findAllByType: (type: string) => ReactTestInstance[];
};

export function host(node: ReactTestInstance): Finder {
  return node as unknown as Finder;
}
