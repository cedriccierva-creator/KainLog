import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import AddFoodScreen from './screens/AddFoodScreen';
import DiaryScreen from './screens/DiaryScreen';
import FoodsScreen from './screens/FoodsScreen';
import ProfileScreen from './screens/ProfileScreen';
import ProgressScreen from './screens/ProgressScreen';

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DiaryScreen />} />
        <Route path="add" element={<AddFoodScreen />} />
        <Route path="foods" element={<FoodsScreen />} />
        <Route path="progress" element={<ProgressScreen />} />
        <Route path="profile" element={<ProfileScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
