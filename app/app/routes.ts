import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("t/:domain/:topic/:lesson?", "routes/topic.tsx"),
  route("doc/*", "routes/doc.tsx"),
  route("labs", "routes/labs.tsx"),
  route("lab/:state", "routes/lab.ts"),
  route("*", "routes/missing.ts"),
] satisfies RouteConfig;
