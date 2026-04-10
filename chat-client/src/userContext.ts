const API_URL = `http://${window.location.hostname}:3001/api/auth`;

export interface User {
  id: number;
  email: string;
  username: string;
}

interface AuthResponse {
  token: string;
  user: {
    id: number;
    firstname: string;
    lastname: string;
    email: string;
    username: string;
  };
}

type UserChangeListener = (user: User | null) => void;

class UserContext {
  private user: User | null = null;
  private token: string | null = null;
  private listeners: UserChangeListener[] = [];

  constructor() {
    this.load();
  }

  private load() {
    const stored = localStorage.getItem("lime_user");
    const token = localStorage.getItem("lime_token");
    if (stored && token) {
      this.user = JSON.parse(stored);
      this.token = token;
    }
  }

  private save() {
    if (this.user && this.token) {
      localStorage.setItem("lime_user", JSON.stringify(this.user));
      localStorage.setItem("lime_token", this.token);
    } else {
      localStorage.removeItem("lime_user");
      localStorage.removeItem("lime_token");
    }
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.user);
    }
  }

  onChange(listener: UserChangeListener) {
    this.listeners.push(listener);
  }

  getUser(): User | null {
    return this.user;
  }

  getToken(): string | null {
    return this.token;
  }

  isLoggedIn(): boolean {
    return this.user !== null && this.token !== null;
  }

  async login(email: string, password: string): Promise<User> {
    const res = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erreur de connexion");
    }

    const data: AuthResponse = await res.json();
    this.token = data.token;
    this.user = {
      id: data.user.id,
      email: data.user.email,
      username: data.user.username,
    };
    this.save();
    this.notify();
    return this.user;
  }

  async register(
    firstname: string,
    lastname: string,
    email: string,
    username: string,
    password: string,
  ): Promise<void> {
    const res = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstname, lastname, email, username, password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Erreur lors de l'inscription");
    }
  }

  logout() {
    this.user = null;
    this.token = null;
    this.save();
    this.notify();
  }
}

export const userContext = new UserContext();
