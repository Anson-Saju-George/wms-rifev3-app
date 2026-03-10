import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <header className="fixed top-0 w-full backdrop-blur-lg bg-[#04162E]/80 z-50">
      <div className="max-w-6xl mx-auto flex justify-between items-center pt-4 pb-2 px-6">
        <Link to="/" className="font-heading text-lg">
          WMS
        </Link>

        <nav className="flex gap-6 text-sm">
          <Link to="/">Home</Link>
          <Link to="/research">Research</Link>
        </nav>
      </div>
    </header>
  );
}
