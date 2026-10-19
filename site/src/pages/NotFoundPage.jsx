import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="wrap">
      <div className="empty not-found">
        <h1 tabIndex={-1}>Page not found</h1>
        <p>This plugin or page is not in the catalog. It may have been renamed or removed from the marketplace.</p>
        <Link className="btn btn-primary" to="/">Go to the catalog</Link>
      </div>
    </div>
  );
}
