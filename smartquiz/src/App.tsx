import { useEffect } from 'react';
import {
  HashRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { AuthProvider } from './data/auth';
import { AppProvider } from './data/store';
import { RequireRole } from './components/RequireRole';
import { ToastProvider } from './components/Toast';
import LandingPage from './pages/Landing';
import AuthPage from './pages/Auth';
import ForgotPasswordPage from './pages/ForgotPassword';
import NotFoundPage from './pages/NotFound';
import AdminDashboard from './pages/admin/Dashboard';
import ExamBuilder from './pages/admin/Builder';
import ExamResults from './pages/admin/Results';
import AdminStudents from './pages/admin/Students';
import ProfilePage from './pages/Profile';
import StudentHome from './pages/student/Home';
import TakeExamPage from './pages/student/TakeExam';
import StudentResultPage from './pages/student/Result';
import { AdminShell } from './components/AdminShell';
import { StudentShell } from './components/StudentShell';
import { InstallApp } from './components/InstallApp';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <ToastProvider>
          <HashRouter>
            <ScrollToTop />
            <InstallApp />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<AuthPage />} />
              <Route path="/register" element={<AuthPage initialMode="register" />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route
                path="/admin"
                element={
                  <RequireRole role="admin">
                    <AdminShell>
                      <Outlet />
                    </AdminShell>
                  </RequireRole>
                }
              >
                <Route index element={<AdminDashboard />} />
                <Route path="students" element={<AdminStudents />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="exams/:examId/edit" element={<ExamBuilder />} />
                <Route path="exams/:examId/results" element={<ExamResults />} />
              </Route>
              <Route
                path="/student"
                element={
                  <RequireRole role="student">
                    <StudentShell>
                      <Outlet />
                    </StudentShell>
                  </RequireRole>
                }
              >
                <Route index element={<StudentHome />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="result/:attemptId" element={<StudentResultPage />} />
              </Route>
              <Route
                path="/student/exam/:examId"
                element={
                  <RequireRole role="student">
                    <TakeExamPage />
                  </RequireRole>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </HashRouter>
        </ToastProvider>
      </AuthProvider>
    </AppProvider>
  );
}
