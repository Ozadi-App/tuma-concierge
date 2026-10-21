import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  { ignores: [".next/**", ".open-next/**", "node_modules/**", "next-env.d.ts", "public/**"] },
];

export default config;
