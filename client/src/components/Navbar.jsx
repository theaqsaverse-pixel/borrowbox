import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { categoriesApi } from '../api';

function useClickOutside(ref, handler) {
  useEffect(() => {
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && handler();
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [ref, handler]);
}

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false); // mobile menu
  const [catOpen, setCatOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const catRef = useRef(null);
  const userRef = useRef(null);

  useClickOutside(catRef, () => setCatOpen(false));
  useClickOutside(userRef, () => setUserOpen(false));

  useEffect(() => {
    categoriesApi
      .list()
      .then((res) => setCategories(res.data))
      .catch(() => {});
  }, []);

  // close menus when the page changes
  useEffect(() => {
    setOpen(false);
    setCatOpen(false);
    setUserOpen(false);
  }, [location.pathname, location.search]);

  const onLogout = () => {
    logout(); // route guards send an explicit logout to the home page
    navigate('/');
    toast.success('You have been logged out');
  };

  const linkClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`;

  return (
    <header className={`navbar${open ? ' open' : ''}`}>
      <div className="container navbar-inner">
        <Link to="/" className="brand" aria-label="BorrowBox home">
          <span className="brand-mark">B</span>
          BorrowBox
        </Link>

        <button className="nav-toggle" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu" aria-expanded={open}>
          {open ? '✕' : '☰'}
        </button>

        <nav className="nav-links" aria-label="Main">
          <NavLink to="/" end className={linkClass}>
            Browse
          </NavLink>
          {!isAuthenticated && (
            <Link to="/#how-it-works" className="nav-link">
              How it works
            </Link>
          )}
          {isAuthenticated && (
            <>
              <NavLink to="/dashboard" end className={() => `nav-link${location.pathname === '/dashboard' && !location.search.includes('tab=items') ? ' active' : ''}`}>
                Dashboard
              </NavLink>
              <Link to="/dashboard?tab=items" className={`nav-link${location.search.includes('tab=items') ? ' active' : ''}`}>
                My Items
              </Link>
            </>
          )}
          {isAdmin && (
            <NavLink to="/admin" className={linkClass}>
              Admin
            </NavLink>
          )}

          <div className="dropdown" ref={catRef}>
            <button className="nav-link" onClick={() => setCatOpen((v) => !v)} aria-expanded={catOpen}>
              Categories ▾
            </button>
            {catOpen && (
              <div className="dropdown-menu">
                {categories.length === 0 && <span className="dropdown-item muted">No categories yet</span>}
                {categories.map((c) => (
                  <Link key={c.id} to={`/?category=${c.id}`} className="dropdown-item">
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="nav-actions">
          {isAuthenticated ? (
            <>
              <Link to="/items/new" className="btn btn-blue btn-sm">
                + Lend an item
              </Link>
              <div className="dropdown" ref={userRef}>
                <button className="avatar-btn" onClick={() => setUserOpen((v) => !v)} aria-expanded={userOpen}>
                  <span className="avatar">{user.name.charAt(0).toUpperCase()}</span>
                  <span>{user.name.split(' ')[0]}</span>
                </button>
                {userOpen && (
                  <div className="dropdown-menu right">
                    <Link to={`/profile/${user.id}`} className="dropdown-item">
                      My profile
                    </Link>
                    <Link to="/dashboard" className="dropdown-item">
                      Dashboard
                    </Link>
                    <div className="dropdown-divider" />
                    <button className="dropdown-item" onClick={onLogout}>
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-outline btn-sm">
                Login
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
