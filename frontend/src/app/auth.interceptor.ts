import { HttpInterceptorFn } from '@angular/common/http';
export const authInterceptor: HttpInterceptorFn = (request, next) => { const token = localStorage.getItem('fitfam_token') || sessionStorage.getItem('fitfam_token'); return next(token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request); };
