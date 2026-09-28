import { useState, useRef, useEffect } from "react";
import {
  useConvexAuth,
  usePaginatedQuery,
  useQuery,
  useMutation,
} from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  LayoutDashboard,
  Users,
  Building2,
  LogOut,
  ArrowUpRight,
  ArrowRight,
  Search,
  X,
  HeartHandshake,
  CircleCheck,
  Mail,
  ChevronRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { api } from "../convex/_generated/api";
import logo from "./assets/amanah-logo-transparent.png";
const publicSiteUrl = (
  import.meta.env.VITE_PUBLIC_SITE_URL ||
  "https://reimage-demo.github.io/amanah"
).replace(/\/$/, "");
const statuses = {
  new: "New",
  contacted: "Contacted",
  follow_up: "Follow up",
  onboarding: "Onboarding",
  welcomed: "Welcomed",
  archived: "Archived",
};
const labels = {
  full_name: "Full name",
  email: "Email address",
  specialty: "Medical specialty",
  country: "Practice country",
  state: "State / province",
  contribution: "Preferred contribution",
  availability: "Availability",
  languages: "Languages spoken",
  contact_name: "Contact name",
  organization: "Organization",
  role: "Role / title",
  location: "Country / city",
  interests: "Areas of interest",
  needs: "Institutional needs",
};
const date = (value) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const initials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join("");
function Login() {
  const { signIn } = useAuthActions();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [visible, setVisible] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget);
    try {
      await signIn("password", {
        email: data.get("username"),
        password: data.get("password"),
        flow: "signIn",
      });
    } catch {
      setError(
        "Unable to sign in. Check your username and password. If you have tried several times, please wait before trying again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <img className="auth-logo" src={logo} alt="Amanah Medical" />
        <p className="eyebrow">Admin Portal</p>
        <h1>Sign in</h1>
        <label htmlFor="username">
          Username
          <input
            id="username"
            name="username"
            autoComplete="username"
            required
            maxLength={100}
          />
        </label>
        <label htmlFor="password">Password</label>
        <div className="password-field">
          <input
            id="password"
            name="password"
            type={visible ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={256}
          />
          <button
            type="button"
            className="reveal"
            aria-label={visible ? "Hide password" : "Show password"}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

function Detail({ id, close }) {
  const data = useQuery(api.signees.detail, { id });
  const update = useMutation(api.signees.updateStatus),
    addNote = useMutation(api.signees.addNote);
  const [note, setNote] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const dialog = useRef(null);
  useEffect(() => {
    const el = dialog.current;
    el.showModal();
    return () => el.close();
  }, []);
  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch {
      setError("Your change could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const signee = data?.signee;
  return (
    <dialog
      ref={dialog}
      className="detail"
      onCancel={close}
      onClick={(e) => {
        if (e.target === dialog.current) close();
      }}
      aria-labelledby="detail-heading"
    >
      <div className="detail-inner">
        <button
          className="close icon-button"
          onClick={close}
          aria-label="Close details"
        >
          <X />
        </button>
        {!data ? (
          <p>Loading details…</p>
        ) : !signee ? (
          <h2 id="detail-heading">Record unavailable</h2>
        ) : (
          <>
            <span className="eyebrow">
              {signee.kind === "physician"
                ? "MOVEMENT SIGNEE"
                : "PARTNERSHIP INQUIRY"}
            </span>
            <h2 id="detail-heading">{signee.name}</h2>
            <p>Received {date(signee._creationTime)}</p>
            <a className="email-link" href={`mailto:${signee.email}`}>
              <Mail size={16} />
              {signee.email}
            </a>
            <label className="status-edit">
              Follow-up status
              <select
                value={signee.status}
                disabled={busy}
                onChange={(e) =>
                  run(() => update({ id, status: e.target.value }))
                }
              >
                {Object.entries(statuses).map(([key, value]) => (
                  <option value={key} key={key}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <h3>In their own words</h3>
            <dl>
              {Object.entries(signee.answers).map(([key, value]) => (
                <div key={key}>
                  <dt>{labels[key] || key}</dt>
                  <dd>{value || "Not provided"}</dd>
                </div>
              ))}
            </dl>
            <section className="notes">
              <h3>Team notes</h3>
              <p className="muted">Private to the Amanah team.</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(async () => {
                    await addNote({ id, body: note });
                    setNote("");
                  });
                }}
              >
                <label className="sr-only" htmlFor="note">
                  Add a team note
                </label>
                <textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={3000}
                  placeholder="Capture a conversation or a thoughtful next step…"
                  required
                />
                <button className="primary" disabled={busy || !note.trim()}>
                  Save note <ArrowRight size={16} />
                </button>
              </form>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              {data.notes.map((n) => (
                <article className="note" key={n._id}>
                  <small>{date(n._creationTime)}</small>
                  <p>{n.body}</p>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </dialog>
  );
}
function Workspace({ tab, setTab }) {
  const kind = tab === "partners" ? "hospital" : "physician";
  const { results, status, loadMore } = usePaginatedQuery(
    api.signees.list,
    { kind },
    { initialNumItems: 50 },
  );
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState(null);
  useEffect(() => {
    setSearch("");
    setFilter("all");
    setSelected(null);
  }, [tab]);
  const rows = results.filter(
    (r) =>
      (filter === "all" || r.status === filter) &&
      [r.name, r.email, ...Object.values(r.answers)]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const overview = tab === "overview";
  return (
    <>
      <header className="page-header">
        <div>
          <span className="eyebrow">THE AMANAH MOVEMENT</span>
          <h1>
            {overview
              ? "A purpose shared."
              : tab === "partners"
                ? "Partnerships"
                : "Signees"}
          </h1>
          <p>
            {overview
              ? "Behind every name, a willingness to make a difference."
              : tab === "partners"
                ? "Building relationships that bring better care closer."
                : "Meet the people ready to help change the world."}
          </p>
        </div>
        <a
          href={`${publicSiteUrl}/physicians.html#volunteer`}
          target="_blank"
          rel="noreferrer"
          className="outline"
        >
          View join form <ArrowUpRight size={16} />
        </a>
      </header>
      {overview && (
        <section className="welcome-banner">
          <div>
            <span className="eyebrow gold">EVERY CONNECTION MATTERS</span>
            <h2>
              A warmer welcome.
              <br />A stronger movement.
            </h2>
            <p>Take a moment to connect with someone new today.</p>
            <button onClick={() => setTab("signees")}>
              Meet your signees <ArrowRight size={17} />
            </button>
          </div>
          <HeartHandshake size={130} strokeWidth={0.6} />
        </section>
      )}
      <section className="stats" aria-label="Loaded record summary">
        {[
          [Users, "Signees", results.length],
          [
            Mail,
            "Awaiting a welcome",
            results.filter((x) => x.status === "new").length,
          ],
          [
            CircleCheck,
            "In onboarding",
            results.filter((x) => x.status === "onboarding").length,
          ],
        ].map(([Icon, label, value]) => (
          <article key={label}>
            <div>
              <span>
                {kind === "hospital" && label === "Signees"
                  ? "Partnership inquiries"
                  : label}
              </span>
              <strong>
                {status === "LoadingFirstPage"
                  ? "—"
                  : `${value}${status === "CanLoadMore" ? "+" : ""}`}
              </strong>
            </div>
            <Icon size={22} strokeWidth={1.5} />
          </article>
        ))}
      </section>
      {status === "CanLoadMore" && (
        <p className="muted">
          Counts and search reflect loaded records. Load more below to include
          earlier submissions.
        </p>
      )}
      <section className="records">
        <div className="records-heading">
          <div>
            <h2>
              {overview
                ? "Your community, growing"
                : tab === "partners"
                  ? "Partnership inquiries"
                  : "The people behind the purpose"}
            </h2>
            <p>Thoughtful follow-up starts here.</p>
          </div>
          <span className="live">
            <i /> Live updates
          </span>
        </div>
        <div className="toolbar">
          <label className="search">
            <Search size={18} />
            <input
              aria-label="Search records"
              placeholder="Search name, email, specialty…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Filter by status"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            {Object.entries(statuses).map(([key, value]) => (
              <option value={key} key={key}>
                {value}
              </option>
            ))}
          </select>
        </div>
        {status === "LoadingFirstPage" ? (
          <div className="empty">Loading your community…</div>
        ) : rows.length === 0 ? (
          <div className="empty">
            <div className="seal">
              <Users size={25} />
            </div>
            <h3>
              {search || filter !== "all"
                ? "No matching records"
                : "Every movement begins with one."}
            </h3>
            <p>
              {search || filter !== "all"
                ? "Try another search or status."
                : "New submissions will appear here, ready for a personal welcome."}
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{kind === "hospital" ? "CONTACT" : "SIGNEE"}</th>
                  <th>{kind === "hospital" ? "ORGANIZATION" : "SPECIALTY"}</th>
                  <th>RECEIVED</th>
                  <th>STATUS</th>
                  <th>
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row._id}>
                    <td>
                      <div className="person">
                        <span className="avatar">{initials(row.name)}</span>
                        <div>
                          <button
                            className="name"
                            onClick={() => setSelected(row._id)}
                          >
                            {row.name}
                          </button>
                          <span>{row.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {row.answers.specialty || row.answers.organization}
                      <small>
                        {row.answers.country || row.answers.location}
                      </small>
                    </td>
                    <td>{date(row._creationTime)}</td>
                    <td>
                      <span className={`badge ${row.status}`}>
                        {statuses[row.status]}
                      </span>
                    </td>
                    <td>
                      <button
                        className="icon-button"
                        onClick={() => setSelected(row._id)}
                        aria-label={`View ${row.name}`}
                      >
                        <ChevronRight size={19} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <footer className="table-footer">
          <span>
            {rows.length} {rows.length === 1 ? "record" : "records"} shown
          </span>
          {status === "CanLoadMore" || status === "LoadingMore" ? (
            <button
              className="outline"
              disabled={status === "LoadingMore"}
              onClick={() => loadMore(50)}
            >
              {status === "LoadingMore" ? "Loading…" : "Load more"}
            </button>
          ) : (
            <span>With purpose. With care.</span>
          )}
        </footer>
      </section>
      <p className="workspace-footer">
        AMANAH MEDICAL <span>Entrusted with care.</span>
      </p>
      {selected && (
        <Detail key={selected} id={selected} close={() => setSelected(null)} />
      )}
    </>
  );
}
export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const [tab, setTab] = useState("overview"),
    [error, setError] = useState("");
  if (isLoading)
    return (
      <main className="recovery">
        <img width="180" src={logo} alt="Amanah Medical" />
        <p>Opening your portal…</p>
      </main>
    );
  if (!isAuthenticated) return <Login />;
  return (
    <div className="portal">
      <aside className="sidebar">
        <a className="brand" href={`${publicSiteUrl}/`}>
          <img src={logo} alt="Amanah Medical" />
        </a>
        <span className="sidebar-label">STEWARDSHIP PORTAL</span>
        <nav aria-label="Administration">
          {[
            [LayoutDashboard, "overview", "Overview"],
            [Users, "signees", "Signees"],
            [Building2, "partners", "Partnerships"],
          ].map(([Icon, key, label]) => (
            <button
              key={key}
              className={tab === key ? "active" : ""}
              aria-current={tab === key ? "page" : undefined}
              onClick={() => setTab(key)}
            >
              <Icon size={19} />
              {label}
              {tab === key && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mission">
            <HeartHandshake size={23} />
            <p>
              One shared purpose.
              <br />A world of possibility.
            </p>
          </div>
          <div className="admin-person">
            <span className="avatar">AM</span>
            <div>
              <strong>Amanah team</strong>
              <small>Administrator</small>
            </div>
          </div>
          <button
            className="logout"
            onClick={async () => {
              try {
                await signOut();
              } catch {
                setError("Could not sign out. Please try again.");
              }
            }}
          >
            <LogOut size={17} /> Sign out
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      </aside>
      <main className="workspace">
        <Workspace tab={tab} setTab={setTab} />
      </main>
    </div>
  );
}
