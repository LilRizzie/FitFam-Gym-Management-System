import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../environments/environment';
import { AuthUser } from './models';

interface AuthResponse { success: boolean; token: string; user: AuthUser; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly loggedIn = signal(!!(localStorage.getItem('fitfam_token') || sessionStorage.getItem('fitfam_token')));
  private readonly currentUser = signal<AuthUser | null>(this.readUser());
  readonly isLoggedIn = this.loggedIn.asReadonly();
  readonly user = this.currentUser.asReadonly();
  readonly role = () => this.currentUser()?.role;
  constructor(private router: Router, private http: HttpClient) {}
  login(email: string, password: string, remember = false): Observable<boolean> { return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, { email, password }).pipe(tap(response => { const storage = remember ? localStorage : sessionStorage; storage.setItem('fitfam_token', response.token); storage.setItem('fitfam_user', JSON.stringify(response.user)); if (!remember) { localStorage.removeItem('fitfam_token'); localStorage.removeItem('fitfam_user'); } this.currentUser.set(response.user); this.loggedIn.set(true); }), map(() => true)); }
  register(payload: { firstName: string; lastName: string; email: string; password: string }): Observable<boolean> { return this.http.post<AuthResponse>(`${environment.apiUrl}/auth/register`, payload).pipe(map(() => true)); }
  roleDashboard(): string { return `/dashboard/${this.role() || 'member'}`; }
  logout(): void { localStorage.removeItem('fitfam_token'); localStorage.removeItem('fitfam_user'); sessionStorage.removeItem('fitfam_token'); sessionStorage.removeItem('fitfam_user'); this.currentUser.set(null); this.loggedIn.set(false); void this.router.navigate(['/login']); }
  private readUser(): AuthUser | null { try { return JSON.parse(localStorage.getItem('fitfam_user') || sessionStorage.getItem('fitfam_user') || 'null') as AuthUser | null; } catch { return null; } }
}
