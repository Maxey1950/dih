import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

const config = [
  ...nextCoreWebVitals,
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      '@next/next/no-img-element': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      // React Compiler rules added in eslint-plugin-react-hooks 7 (Next 16).
      // The migrated AlphaBlox pages use the classic "fetch in useEffect"
      // pattern, which is correct at runtime but trips these rules. Kept as
      // warnings until each page moves to a data-fetching hook (see docs/TODO).
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
  { ignores: ['.next/**', 'node_modules/**'] },
];

export default config;
