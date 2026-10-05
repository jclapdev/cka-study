import { data } from "react-router";

export function loader() {
  throw data(null, { status: 404 });
}

// The loader always throws, so the error page is all that renders.
export default function Missing() {
  return null;
}

export { Problem as ErrorBoundary } from "~/root";
