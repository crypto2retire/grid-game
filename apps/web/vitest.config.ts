/** @type {import('vitest/config').UserConfig} */
export default {
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
};
