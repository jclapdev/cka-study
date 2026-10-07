import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("t/:domain/:topic/:lesson?", "routes/topic.tsx"),
  route("doc/*", "routes/doc.tsx"),
  route("lab/:state", "routes/lab.ts"),
  route("terminal", "routes/terminal.tsx"),
  route("*", "routes/missing.ts"),
] satisfies RouteConfig;
