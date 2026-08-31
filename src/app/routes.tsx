import { Route, Routes } from 'react-router-dom'
import { ConsoleLayout } from './layouts/ConsoleLayout'
import {
  AcceptInvitePage,
  ForgotPasswordPage,
  LoginPage,
  RedirectIfSignedIn,
  RequireAuth,
  ResetPasswordPage,
} from '../features/auth'
import { NotificationsPage } from '../features/notifications'
import { DashboardPage } from '../features/dashboard'
import { LiveMapPage } from '../features/live-map'
import { DriverDetailPage, DriversPage } from '../features/drivers'
import { VehicleDetailPage, VehiclesPage } from '../features/vehicles'
import { HoursPage } from '../features/hours'
import { InspectionsPage } from '../features/inspections'
import { DispatchPage, RouteDetailPage } from '../features/dispatch'
import { FormsPage } from '../features/forms'
import { MessagesPage } from '../features/messages'
import { SafetyPage } from '../features/safety'
import { TrainingPage } from '../features/training'
import { DocumentsPage } from '../features/documents'
import { ReportsPage } from '../features/reports'
import { UsersPage } from '../features/users'
import { SettingsPage } from '../features/settings'

/**
 * Two guarded groups.
 *
 * Signed-out screens bounce an already-signed-in user to the console, and every
 * console route bounces a signed-out one to the login screen. Opening the app
 * therefore always starts at sign-in until a session exists.
 *
 * Paths match `src/modules.ts`, which drives the sidebar — a route added here
 * without an entry there is unreachable, and vice versa.
 */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<RedirectIfSignedIn />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<ConsoleLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="/map" element={<LiveMapPage />} />

          <Route path="/drivers" element={<DriversPage />} />
          <Route path="/drivers/:driverId" element={<DriverDetailPage />} />
          <Route path="/vehicles" element={<VehiclesPage />} />
          <Route path="/vehicles/:vehicleId" element={<VehicleDetailPage />} />

          <Route path="/hours" element={<HoursPage />} />
          <Route path="/inspections" element={<InspectionsPage />} />

          <Route path="/dispatch" element={<DispatchPage />} />
          <Route path="/dispatch/:routeId" element={<RouteDetailPage />} />
          <Route path="/forms" element={<FormsPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/documents" element={<DocumentsPage />} />

          <Route path="/safety" element={<SafetyPage />} />
          <Route path="/training" element={<TrainingPage />} />

          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="*" element={<DashboardPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
