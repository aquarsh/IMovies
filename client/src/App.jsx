import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

// IMovies: React + Vite + TMDB movie discovery .
// Keep your existing TMDB key here, OR add VITE_TMDB_API_KEY to client/.env.
const API_KEY = import.meta.env.VITE_TMDB_API_KEY || "PASTE_YOUR_EXISTING_TMDB_API_KEY_HERE";
const API_ROOT = "https://api.themoviedb.org/3";
const IMAGE_ROOT = "https://image.tmdb.org/t/p";
const POSTER_SIZE = "w500";
const BACKDROP_SIZE = "w1280";
const GENRES = [
  { id: "all", name: "All films" },
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 18, name: "Drama" },
  { id: 14, name: "Fantasy" },
  { id: 9648, name: "Mystery" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Sci-Fi" },
  { id: 53, name: "Thriller" },
  { id: 27, name: "Horror" },
];
const SHOWTIMES = ["10:30 AM", "1:15 PM", "4:00 PM", "6:45 PM", "9:30 PM"];
const THEATRES = [
  { id: "pvr-ti", name: "PVR Cinemas · Treasure Island", area: "MG Road", format: "IMAX / 2D" },
  { id: "cinepolis-c21", name: "Cinépolis · C21 Mall", area: "AB Road", format: "2D / 3D" },
  { id: "inox-central", name: "INOX · Central Mall", area: "Indore", format: "2D / 3D" },
  { id: "imovies-", name: "IMovies  Screen", area: "Online  theatre", format: " screening" },
];
const PAYMENT_METHODS = [
  { id: "upi", name: "UPI / QR", detail: "Scan a  QR" },
  { id: "card", name: "Credit / debit card", detail: " card checkout" },
  { id: "netbanking", name: "Net banking", detail: " bank selection" },
  { id: "counter", name: "Pay at theatre", detail: "Reserve now, pay at counter" },
];
const SEAT_ROWS = ["A", "B", "C", "D", "E", "F", "G"];
const SEATS_PER_ROW = 10;
const money = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
const shuffle = (items) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
const posterUrl = (path) => path ? `${IMAGE_ROOT}/${POSTER_SIZE}${path}` : "";
const backdropUrl = (path) => path ? `${IMAGE_ROOT}/${BACKDROP_SIZE}${path}` : "";
const releaseYear = (movie) => (movie?.release_date || "").slice(0, 4) || "Coming soon";
const genreNames = (movie) => {
  if (Array.isArray(movie?.genres) && movie.genres.length) return movie.genres.map((g) => g.name).join(" · ");
  const ids = movie?.genre_ids || [];
  return ids.map((id) => GENRES.find((g) => g.id === id)?.name).filter(Boolean).slice(0, 3).join(" · ") || "Cinema";
};

async function tmdb(path, params = {}) {
  if (!API_KEY || API_KEY === "PASTE_YOUR_EXISTING_TMDB_API_KEY_HERE") {
    throw new Error("Add your existing TMDB API key in App.jsx or client/.env first.");
  }
  const url = new URL(`${API_ROOT}${path}`);
  url.searchParams.set("api_key", API_KEY);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Movie service error (${response.status}). Please try again.`);
  return response.json();
}

function Icon({ name, size = 18 }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  const paths = {
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    ticket: <><path d="M4 7a2 2 0 0 0 0 4v2a2 2 0 0 0 0 4h16v-4a2 2 0 0 1 0-4V5H4z" /><path d="M13 5v2M13 11v2M13 17v2" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    back: <><path d="m15 18-6-6 6-6" /></>,
    star: <><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    play: <path d="m8 5 11 7-11 7z" />,
    heart: <path d="M20.8 8.8c0 5.1-8.8 10-8.8 10S3.2 13.9 3.2 8.8A4.8 4.8 0 0 1 12 6.2a4.8 4.8 0 0 1 8.8 2.6Z" />,
  };
  return <svg {...common}>{paths[name] || paths.star}</svg>;
}

function HeroMovieArt({ movie }) {
  const image = movie?.backdrop_path ? backdropUrl(movie.backdrop_path) : posterUrl(movie?.poster_path);
  return (
    <div className="movie-banner-art" style={image ? { backgroundImage: `linear-gradient(180deg, rgba(8, 13, 42, .04) 15%, rgba(8, 13, 42, .22) 48%, rgba(8, 13, 42, .92) 100%), url("${image}")` } : undefined} aria-label={movie ? `${movie.title || movie.name} movie banner` : "Cinematic movie banner"} role="img">
      {!image && <div className="banner-fallback-art"><span>✦</span><strong>IMovies</strong><small>YOUR NEXT MOVIE NIGHT STARTS HERE</small></div>}
      <span className="banner-film-chip">NOW SHOWING · IMOVIES</span>
      {movie && <div className="banner-movie-title"><span>FEATURED FILM</span><strong>{movie.title || movie.name}</strong><small>{releaseYear(movie)} · ★ {Number(movie.vote_average || 0).toFixed(1)} / 10</small></div>}
      <div className="banner-film-grain" />
    </div>
  );
}

function MovieCard({ movie, onOpen, index = 0 }) {
  return (
    <button className="movie-card" onClick={() => onOpen(movie)} style={{ "--card-index": index }} type="button" aria-label={`View ${movie.title || movie.name}`}>
      <div className="poster-wrap">
        {movie.poster_path ? <img src={posterUrl(movie.poster_path)} alt={`${movie.title || movie.name} poster`} loading={index > 5 ? "lazy" : "eager"} /> : <div className="poster-fallback">{movie.title || movie.name}</div>}
        <span className="rating"><Icon name="star" size={13} /> {Number(movie.vote_average || 0).toFixed(1)}</span>
        <span className="card-view">View film <Icon name="arrow" size={14} /></span>
      </div>
      <div className="movie-card-copy">
        <h3>{movie.title || movie.name}</h3>
        <p>{releaseYear(movie)} <span>·</span> {genreNames(movie).split(" · ").slice(0, 2).join(" / ")}</p>
      </div>
    </button>
  );
}

export default function App() {
  const [movies, setMovies] = useState([]);
  const [popularMovies, setPopularMovies] = useState([]);
  const [homeMovies, setHomeMovies] = useState([]);
  const [heroMovie, setHeroMovie] = useState(null);
  const [page, setPage] = useState("home");
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("all");
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState("");
  const [apiMode, setApiMode] = useState("popular");
  const [showtimes, setShowtimes] = useState(SHOWTIMES[2]);
  const [theatreId, setTheatreId] = useState(THEATRES[0].id);
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [paymentReady, setPaymentReady] = useState(false);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [bookings, setBookings] = useState(() => {
    try { return JSON.parse(localStorage.getItem("imovies-bookings") || "[]"); } catch { return []; }
  });
  const [savedIds, setSavedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("imovies-watchlist") || "[]"); } catch { return []; }
  });
  useEffect(() => {
  fetch("http://localhost:5000/api/bookings")
    .then(response => {
      if (!response.ok) throw new Error("Failed to load bookings");
      return response.json();
    })
    .then(data => setBookings(data))
    .catch(error => console.error("Loading bookings:", error));
}, []);
  const [toast, setToast] = useState("");
  
const clearBookings = async () => {
  if (!window.confirm("Are you sure you want to clear all bookings?")) {
    return;
  }

  try {
    const response = await fetch("http://localhost:5000/api/bookings", {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error("Could not clear bookings.");
    }

    localStorage.removeItem("imovies-bookings");
    setBookings([]);
    setConfirmedBooking(null);
    setToast("All bookings cleared!");
  } catch (error) {
    setToast(error.message);
  }
};

  const loadMovies = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Load several pages so the collection contains far more than the first 20 titles.
      const pages = await Promise.all([1, 2, 3].map((p) => tmdb("/movie/popular", { page: p, region: "IN" })));
      const combined = pages.flatMap((data) => data.results || []);
      const unique = [...new Map(combined.map((movie) => [movie.id, movie])).values()];
      setPopularMovies(unique);
      setMovies(unique);
      // Shuffle each time the app starts/reloads, then show up to 12 different titles on Home.
      setHomeMovies(shuffle(unique).slice(0, 12));
      // Remember the previous banner ID so a page refresh prefers a different film.
      const previousHeroId = Number(localStorage.getItem("imovies-hero-movie-id") || 0);
      const heroPool = unique.filter((movie) => movie.backdrop_path && movie.id !== previousHeroId);
      const nextHero = shuffle(heroPool.length ? heroPool : unique.filter((movie) => movie.backdrop_path))[0] || unique[0] || null;
      setHeroMovie(nextHero);
      if (nextHero?.id) localStorage.setItem("imovies-hero-movie-id", String(nextHero.id));
      setApiMode("popular");
    } catch (e) {
      setError(e.message || "Could not load films. Check your connection and API key.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { document.title = "IMovies | Discover your next film"; }, []);
  useEffect(() => { loadMovies(); }, [loadMovies]);
  useEffect(() => { localStorage.setItem("imovies-bookings", JSON.stringify(bookings)); }, [bookings]);
  useEffect(() => { localStorage.setItem("imovies-watchlist", JSON.stringify(savedIds)); }, [savedIds]);
  // Load bookings from MongoDB and refresh every 3 seconds
useEffect(() => {
  let cancelled = false;

  const loadBookings = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/bookings"
      );

      if (!response.ok) {
        throw new Error("Failed to load bookings");
      }

      const data = await response.json();

      if (!cancelled && Array.isArray(data)) {
        setBookings(data);
      }
    } catch (error) {
      if (!cancelled) {
        console.error("Loading bookings:", error);
      }
    }
  };

  loadBookings();

  const interval = window.setInterval(loadBookings, 3000);

  return () => {
    cancelled = true;
    window.clearInterval(interval);
  };
}, []);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!query.trim()) {
      setSearchLoading(false);
      setApiMode("popular");
      setMovies(popularMovies);
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await tmdb("/search/movie", { query: query.trim(), include_adult: false, page: 1, region: "IN" });
        if (!cancelled) { setMovies(data.results || []); setApiMode("search"); setError(""); }
      } catch (e) {
        if (!cancelled) setError(e.message || "Search failed.");
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 350);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query, popularMovies]);

  const filteredMovies = useMemo(() => movies.filter((movie) => {
    if (genre === "all") return true;
    return (movie.genre_ids || movie.genres?.map((g) => g.id) || []).includes(Number(genre));
  }), [movies, genre]);

  const openMovie = async (movie) => {
    setSelectedMovie(movie);
    setConfirmedBooking(null);
    setSelectedSeats([]);
    setPage("details");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (movie.id && !movie.genres) {
      try {
        const details = await tmdb(`/movie/${movie.id}`, { append_to_response: "credits,videos" });
        setSelectedMovie((current) => current?.id === movie.id ? { ...current, ...details } : current);
      } catch { /* The movie card still works if extra details are unavailable. */ }
    }
  };

  const goHome = () => { setPage("home"); setSelectedMovie(null); setQuery(""); setGenre("all"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const goMovies = () => { setPage("movies"); setSelectedMovie(null); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const isSeatBooked = (seat) =>
  bookings.some(
    (booking) =>
      String(booking.movieId) === String(selectedMovie?.id) &&
      booking.date === bookingDate &&
      booking.time === showtimes &&
      Array.isArray(booking.seats) &&
      booking.seats.includes(seat)
  );

const toggleSeat = (seat) => {
  if (isSeatBooked(seat)) {
    setSelectedSeats((current) =>
      current.filter((s) => s !== seat)
    );

    setToast(
      `Seat ${seat} is already booked. Please choose another seat.`
    );

    return;
  }

  setSelectedSeats((current) =>
    current.includes(seat)
      ? current.filter((s) => s !== seat)
      : current.length < 8
        ? [...current, seat]
        : current
  );
};
  const confirmBooking = async () => {
  if (!selectedMovie || selectedSeats.length === 0) {
    setToast("Choose at least one seat to continue.");
    return;
  }

  const booking = {
    bookingId: `IM${Date.now().toString().slice(-8)}`,
    movieId: selectedMovie.id,
    movieTitle: selectedMovie.title || selectedMovie.name,
    poster: selectedMovie.poster_path,
    date: bookingDate,
    time: showtimes,
    seats: [...selectedSeats].sort(),
    total: selectedSeats.length * 220,
    createdAt: new Date().toISOString()
  };

  try {
    const response = await fetch("http://localhost:5000/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(booking)
    });

    const responseData = await response.json().catch(() => ({}));

if (!response.ok) {
  if (response.status === 409) {
    const latestResponse = await fetch(
      "http://localhost:5000/api/bookings"
    );

    if (latestResponse.ok) {
      const latestBookings = await latestResponse.json();

      if (Array.isArray(latestBookings)) {
        setBookings(latestBookings);
      }
    }
  }

  throw new Error(
    responseData.message ||
      "One or more seats are already booked. Please select different seats."
  );
}



    const savedBooking = responseData;

    setBookings(current => [...current, savedBooking]);
    setConfirmedBooking(savedBooking);
    setSelectedSeats([]);
    setToast("Your booking is confirmed!");
  } catch (error) {
    setToast(error.message || "Could not connect to the server.");
  }
};
  const toggleSaved = (movie) => {
    setSavedIds((current) => current.includes(movie.id) ? current.filter((id) => id !== movie.id) : [...current, movie.id]);
    setToast(savedIds.includes(movie.id) ? "Removed from your watchlist." : "Added to your watchlist.");
  };
  const refreshSelection = () => {
    setHomeMovies(shuffle(popularMovies).slice(0, 12));
    const pool = popularMovies.filter((movie) => movie.backdrop_path && movie.id !== heroMovie?.id);
    const nextHero = shuffle(pool.length ? pool : popularMovies.filter((movie) => movie.backdrop_path))[0] || null;
    setHeroMovie(nextHero);
    if (nextHero?.id) localStorage.setItem("imovies-hero-movie-id", String(nextHero.id));
    setToast("Your movie-night lineup has changed.");
  };

  const movieGrid = (list) => list.map((movie, index) => <MovieCard key={movie.id} movie={movie} onOpen={openMovie} index={index} />);

  return (
    <div className="imovies-app">
      <div className="ambient ambient-a" /><div className="ambient ambient-b" />
      <header className="site-header">
        <button className="brand" onClick={goHome} type="button" aria-label="IMovies home"><span className="brand-mark">✦</span> IMovies<span className="brand-period">.</span></button>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={page === "home" ? "nav-link active" : "nav-link"} onClick={goHome} type="button">Home</button>
          <button className={page === "movies" ? "nav-link active" : "nav-link"} onClick={goMovies} type="button">Browse films</button>
          <button className="button button-quiet" onClick={() => { setPage("bookings"); window.scrollTo({ top: 0, behavior: "smooth" }); }} type="button">My bookings <span className="nav-count">{bookings.length}</span></button>
        </nav>
        <button className="header-cta" onClick={goMovies} type="button">Find a film <Icon name="arrow" size={15} /></button>
      </header>

      {page === "home" && <main>
        <section className="hero shell">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> YOUR NEXT MOVIE NIGHT STARTS HERE</p>
            <h1>Where stories<br />become <em>magic.</em></h1>
            <p className="hero-description">Step into a little movie magic. Discover your next favourite film, choose your seats, and make a night of it.</p>
            <div className="hero-actions"><button className="button button-primary" onClick={goMovies} type="button">Explore movies <Icon name="arrow" size={17} /></button><button className="button button-quiet" onClick={() => { setPage("bookings"); window.scrollTo({ top: 0, behavior: "smooth" }); }} type="button"><Icon name="ticket" size={17} /> My tickets</button></div>
            <div className="hero-footnote"><span className="tiny-stars">✦　✧　✦</span><span>Curated for your next escape</span></div>
          </div>
          <div className="hero-visual"><HeroMovieArt movie={heroMovie} /><div className="hero-image-overlay" /><div className="hero-note"><span className="hero-note-icon">✦</span><div><b>{heroMovie?.title || heroMovie?.name || "A little movie magic"}</b><span>Big stories. Brilliant nights.</span></div></div><button className="hero-chip hero-refresh" type="button" onClick={refreshSelection} aria-label="Change featured movie">✦ EDITOR'S PICK</button></div>
          <div className="hero-bottom-glow" />
        </section>
        <section className="perks shell" aria-label="Booking features"><div className="perk"><span className="perk-icon">✧</span><div><b>Find your film</b><small>Explore stories for every mood</small></div></div><div className="perk"><span className="perk-icon">▦</span><div><b>Choose your seats</b><small>Pick your perfect spot</small></div></div><div className="perk"><span className="perk-icon">✓</span><div><b>Easy  checkout</b><small>Your booking details in one place</small></div></div></section>
        <section className="collection shell" id="collection">
          <div className="section-heading"><div><p className="eyebrow">THE COLLECTION</p><h2>Find your next <em>favourite.</em></h2><p className="section-subtitle">A fresh little constellation of films, picked for you.</p></div><button className="text-link" onClick={goMovies} type="button">View all films <Icon name="arrow" size={16} /></button></div>
          {error && <div className="notice error-notice"><b>Could not load movies.</b><span>{error}</span><button onClick={loadMovies} type="button">Try again</button></div>}
          {loading ? <div className="loading-grid">{Array.from({ length: 6 }, (_, i) => <div className="skeleton-card" key={i}><div /><span /><i /></div>)}</div> : <>
            <div className="movie-grid home-grid">{movieGrid(homeMovies)}</div>
            <div className="collection-footer"><span>Showing {homeMovies.length} hand-picked films</span><button className="button button-outline" onClick={refreshSelection} type="button">Shuffle the collection <span>⟳</span></button><button className="button button-primary small-primary" onClick={goMovies} type="button">Browse all films <Icon name="arrow" size={15} /></button></div>
          </>}
        </section>
        <section className="closing-banner shell"><div className="closing-spark">✧</div><div><p className="eyebrow">THE BEST SEAT IN THE HOUSE</p><h2>Your next great night<br />is only a <em>story away.</em></h2></div><button className="button button-primary" onClick={goMovies} type="button">Choose your movie <Icon name="arrow" size={16} /></button></section>
      </main>}

      {page === "movies" && <main className="shell page-main">
        <div className="page-heading"><p className="eyebrow">THE COLLECTION</p><h1>Find your next <em>favourite.</em></h1><p>Browse the lineup, follow your curiosity, and pick a story.</p></div>
        <label className="search-box"><Icon name="search" size={21} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search films, like Avengers..." aria-label="Search movies" /><span className="search-shortcut">⌕</span>{query && <button type="button" className="clear-search" onClick={() => setQuery("")} aria-label="Clear search"><Icon name="close" size={16} /></button>}</label>
        <div className="genre-list" aria-label="Filter by genre">{GENRES.map((g) => <button type="button" key={g.id} className={String(genre) === String(g.id) ? "genre-pill selected" : "genre-pill"} onClick={() => setGenre(String(g.id))}>{g.name}</button>)}</div>
        <div className="results-line"><span>{searchLoading ? "Searching the cinema universe…" : `${filteredMovies.length} ${filteredMovies.length === 1 ? "film" : "films"}`}</span>{query && <span>Search results for “{query}”</span>}</div>
        {error && <div className="notice error-notice">{error}<button onClick={loadMovies} type="button">Reload popular films</button></div>}
        {loading && !query ? <div className="loading-grid">{Array.from({ length: 8 }, (_, i) => <div className="skeleton-card" key={i}><div /><span /><i /></div>)}</div> : filteredMovies.length ? <div className="movie-grid browse-grid">{movieGrid(filteredMovies)}</div> : <div className="empty-state"><span>✧</span><h2>No films found in this little corner.</h2><p>Try another title or choose a different genre.</p><button className="button button-primary" onClick={() => { setQuery(""); setGenre("all"); }} type="button">Clear filters</button></div>}
        <p className="api-note">Movie information and artwork are provided by TMDB. Search can find films beyond the popular collection.</p>
      </main>}

      {page === "details" && selectedMovie && <main className="details-page shell">
        <button className="back-link" onClick={goMovies} type="button"><Icon name="back" size={17} /> Back to films</button>
        <section className="detail-hero" style={selectedMovie.backdrop_path ? { backgroundImage: `linear-gradient(90deg, rgba(8,10,35,.97) 0%, rgba(8,10,35,.82) 48%, rgba(8,10,35,.35) 100%), url(${backdropUrl(selectedMovie.backdrop_path)})` } : undefined}>
          <div className="detail-poster">{selectedMovie.poster_path ? <img src={posterUrl(selectedMovie.poster_path)} alt={`${selectedMovie.title} poster`} /> : <div className="poster-fallback">{selectedMovie.title}</div>}</div>
          <div className="detail-copy"><p className="eyebrow">YOUR NEXT SCREENING</p><h1>{selectedMovie.title || selectedMovie.name}</h1><div className="detail-meta"><span>{releaseYear(selectedMovie)}</span><span>·</span><span><Icon name="star" size={14} /> {Number(selectedMovie.vote_average || 0).toFixed(1)} / 10</span><span>·</span><span>{genreNames(selectedMovie)}</span></div><p className="overview">{selectedMovie.overview || "A new story is waiting to unfold. Choose a screening below to plan your movie night."}</p><div className="detail-actions"><button className="button button-primary" onClick={() => document.getElementById("booking-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })} type="button"><Icon name="ticket" size={17} /> Choose seats</button><button className="button button-quiet" onClick={() => toggleSaved(selectedMovie)} type="button"><Icon name="heart" size={16} /> {savedIds.includes(selectedMovie.id) ? "Saved" : "Add to watchlist"}</button></div></div>
        </section>
        <section className="booking-panel" id="booking-panel"><div className="section-heading booking-heading"><div><p className="eyebrow">MAKE IT A MOVIE NIGHT</p><h2>Choose your <em>seats.</em></h2><p className="section-subtitle">Pick a date, a screening, then your favourite spots.</p></div><div className="ticket-price">{money(220)} <small>/ seat</small></div></div>
          {confirmedBooking ? <div className="booking-success"><span className="success-check"><Icon name="check" size={26} /></span><p className="eyebrow">IT'S A DATE</p><h2>Your movie night is booked.</h2><p>Booking <b>{confirmedBooking.bookingId}</b> · {confirmedBooking.movieTitle}</p><p><b>Theatre:</b> {confirmedBooking.theatre || "IMovies  Screen"} · {confirmedBooking.theatreArea || ""}</p><p>{confirmedBooking.date} at {confirmedBooking.time} · Seats {confirmedBooking.seats.join(", ")}</p><p><b>Payment:</b> {confirmedBooking.paymentMethod || " checkout"} (not charged)</p><div className="success-total">Total: {money(confirmedBooking.total)}</div><p className="-warning"> booking only. No payment was collected.</p><button className="button button-primary" onClick={() => setPage("bookings")} type="button">View my bookings <Icon name="arrow" size={16} /></button></div> : <>
            <div className="theatre-picker">
              <label className="theatre-select-label" htmlFor="theatre-select"><span className="field-kicker">01 · CHOOSE YOUR THEATRE</span><strong>Where would you like to watch?</strong></label>
              <select id="theatre-select" value={theatreId} onChange={(e) => { setTheatreId(e.target.value); setSelectedSeats([]); setPaymentReady(false); }}>
                {THEATRES.map((theatre) => <option value={theatre.id} key={theatre.id}>{theatre.name} · {theatre.area}</option>)}
              </select>
              <div className="theatre-meta"><span><Icon name="calendar" size={14} /> {THEATRES.find((t) => t.id === theatreId)?.format}</span><span>Selected screening location</span></div>
            </div>
            <div className="booking-controls"><label className="date-control"><span><Icon name="calendar" size={16} /> Screening date</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={bookingDate} onChange={(e) => { setBookingDate(e.target.value); setSelectedSeats([]); }} /></label><div className="time-control"><span>Showtime</span><div className="time-list">{SHOWTIMES.map((time) => <button type="button" key={time} className={showtimes === time ? "time-pill chosen" : "time-pill"} onClick={() => { setShowtimes(time); setSelectedSeats([]); }}>{time}</button>)}</div></div></div>
            <div className="seat-layout"><div className="screen-wrap"><div className="screen-glow" /><div className="screen-shape" /><span>SCREEN THIS WAY</span></div><div className="seat-grid">{SEAT_ROWS.map((row) => <div className="seat-row" key={row}><span className="row-label">{row}</span>{Array.from({ length: SEATS_PER_ROW }, (_, i) => { const seat = `${row}${i + 1}`; const booked = isSeatBooked(seat); const selected = selectedSeats.includes(seat); return <button type="button" key={seat} disabled={booked} aria-label={`Seat ${seat}${booked ? " booked" : selected ? " selected" : " available"}`} title={booked ? "Already booked in this browser" : `Seat ${seat}`} onClick={() => toggleSeat(seat)} className={`seat ${booked ? "occupied" : selected ? "selected" : "available"}`}>{i + 1}</button>; })}<span className="row-label">{row}</span></div>)}</div><div className="seat-legend"><span><i className="legend-seat available-legend" /> Available</span><span><i className="legend-seat selected-legend" /> Selected</span><span><i className="legend-seat occupied-legend" /> Booked</span></div><div className="booking-summary"><div><span>Selected seats</span><b>{selectedSeats.length ? [...selectedSeats].sort().join(", ") : "None yet"}</b></div><div><span>Total</span><strong>{money(selectedSeats.length * 220)}</strong></div><div className="booking-total-action"><button className="button button-primary" onClick={() => { setPaymentReady(true); document.getElementById("payment-panel")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} type="button" disabled={!selectedSeats.length}>Continue to payment <Icon name="arrow" size={16} /></button></div></div></div>
              <section className="payment-panel" id="payment-panel">
                <div className="payment-heading"><div><p className="eyebrow">02 · SECURE CHECKOUT PREVIEW</p><h3>Choose how to <em>pay.</em></h3><p>Pick a payment method to preview the  checkout.</p></div><div className="payment-total"><small>AMOUNT DUE</small><strong>{money(selectedSeats.length * 220)}</strong></div></div>
                <div className="payment-options">{PAYMENT_METHODS.map((method) => <button type="button" key={method.id} className={paymentMethod === method.id ? "payment-option selected" : "payment-option"} onClick={() => setPaymentMethod(method.id)}><span className="payment-radio">{paymentMethod === method.id ? "✓" : ""}</span><span><b>{method.name}</b><small>{method.detail}</small></span></button>)}</div>
                {paymentMethod === "upi" && <div className="qr-checkout"><div className="qr-frame"><img alt=" QR code, not a real payment QR" src={"https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=" + encodeURIComponent("IMovies  CHECKOUT - No real payment. Booking reference preview only. Amount INR " + (selectedSeats.length * 220))} /><span> QR</span></div><div className="qr-copy"><b>Scan-to-pay preview</b><p>This QR is a nstration only. It does not transfer money or confirm a real UPI payment.</p><code>imovies.@upi</code></div></div>}
                {paymentMethod === "card" && <div className="payment-fields"><label>Cardholder name<input placeholder="Name on card" /></label><label>Card number<input inputMode="numeric" placeholder="•••• •••• •••• ••••" maxLength="19" /></label><div><label>Expiry<input placeholder="MM/YY" maxLength="5" /></label><label>CVV<input inputMode="numeric" placeholder="•••" maxLength="4" /></label></div><p> only. Do not enter real card details.</p></div>}
                {paymentMethod === "netbanking" && <label className="bank-select-label">Choose a  bank<select defaultValue=""><option value="" disabled>Select bank</option><option>State Bank of India</option><option>HDFC Bank</option><option>ICICI Bank</option><option>Axis Bank</option></select></label>}
                {paymentMethod === "counter" && <div className="counter-note">Your seats will be recorded as a  reservation with “Pay at theatre” selected. No money is collected.</div>}
                <div className="payment-footer"><p><Icon name="check" size={15} /> Checkout · No real payment is processed</p><button className="button button-primary" onClick={() => { if (!selectedSeats.length) { setToast("Choose seats first."); return; } setPaymentReady(true); confirmBooking(); }} type="button" disabled={!selectedSeats.length}>{paymentMethod === "counter" ? "Reserve seats" : "Complete checkout"} <Icon name="arrow" size={16} /></button></div>
              </section>
              <p className="-warning">This is a frontend . Real payments require a payment gateway and secure backend integration. Shared real-time seat availability requires a database-backed booking API.</p>
          </>}</section>
      </main>}

      {page === "bookings" && (<main className="shell page-main bookings-page"><div className="page-heading"><p className="eyebrow">YOUR LITTLE TICKET STUBS</p><h1>My <em>bookings.</em></h1><p>All your reservations, gathered in one place.</p><button className="button button-quiet" onClick={clearBookings} type="button">Clear bookings</button></div>{bookings.length ? (<div className="booking-list">{[...bookings].reverse().map((booking) => (<article className="booking-card" key={booking.bookingId}><div className="booking-thumb">{booking.poster ? (<img src={posterUrl(booking.poster)} alt="" />) : (<span>✦</span>)}</div><div className="booking-card-info"><p className="eyebrow">CONFIRMED · {booking.bookingId}</p><h2>{booking.movieTitle}</h2><p>{booking.date} · {booking.time}</p><p><b>Theatre:</b> {booking.theatre || "IMovies Screen"}</p><p>Seats: {booking.seats.join(", ")}</p><p>Payment: {booking.paymentMethod || "Checkout"}</p></div><div className="booking-card-total"><span>Total</span><b>{money(booking.total)}</b></div></article>))}</div>) : (<div className="empty-state"><span>♧</span><h2>Your ticket wallet is waiting.</h2><p>Choose a film, pick your seats, and your bookings will appear here.</p><button className="button button-primary" onClick={goMovies} type="button">Find a film <Icon name="arrow" size={16} /></button></div>)}<div className="watchlist-block"><div className="section-heading"><div><p className="eyebrow">SAVED FOR LATER</p><h2>Your <em>watchlist.</em></h2></div><button className="text-link" onClick={goMovies} type="button">Find more films <Icon name="arrow" size={15} /></button></div>{popularMovies.filter((movie) => savedIds.includes(movie.id)).length > 0 ? (<div className="movie-grid">{popularMovies.filter((movie) => savedIds.includes(movie.id)).map((movie, index) => (<MovieCard key={movie.id} movie={movie} onOpen={openMovie} index={index} />))}</div>) : (<p className="section-subtitle">Add a film to your watchlist to see it here.</p>)}</div></main>)}
      <footer className="site-footer shell"><button className="brand footer-brand" onClick={goHome} type="button"><span className="brand-mark">✦</span> IMovies<span className="brand-period">.</span></button><p>Made for movie nights and a little bit of magic.</p><span className="footer-credit">Movie data by TMDB ·  booking experience</span></footer>
      {toast && <div className="toast" role="status"><Icon name="check" size={16} /> {toast}</div>}
    </div>
  );
}
