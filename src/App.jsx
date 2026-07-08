import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import ProductDetails from './pages/ProductDetails'
import AdminLogin from './pages/AdminLogin'
import AdminProducts from './pages/AdminProducts'
import AdminBanners from './pages/AdminBanners'
import AdminDashboard from './pages/AdminDashboard'
import AdminSales from './pages/AdminSales'
import AdminStock from './pages/AdminStock'
import AdminFinancial from './pages/AdminFinancial'
import AdminVendedores from './pages/AdminVendedores'
import Footer from "./components/footer.jsx"
import Products from './pages/Products'
import OrbyAdminDashboard from './pages/OrbyAdminDashboard'
import OrbyCreateStore from './pages/OrbyCreateStore'
import OrbyEditStore from './pages/OrbyEditStore'
import Landing from './pages/Landing'
import ScrollToTop from './components/ScrollToTop'

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />

      <Routes>
        <Route path="/orby-admin/dashboard" element={<OrbyAdminDashboard />} />
        <Route path="/orby-admin/criar-loja" element={<OrbyCreateStore />} />
        <Route path="/orby-admin/editar-loja/:storeSlug" element={<OrbyEditStore />} />

        <Route path="/" element={<Landing />} />
        <Route path="/:storeSlug" element={<Home />} />

        <Route path="/produtos" element={<Products />} />
        <Route path="/:storeSlug/produtos" element={<Products />} />

        <Route path="/produto/:id" element={<ProductDetails />} />
        <Route path="/:storeSlug/produto/:id" element={<ProductDetails />} />

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLogin />} />

        <Route path="/admin/:storeSlug/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/:storeSlug/produtos" element={<AdminProducts />} />
        <Route path="/admin/:storeSlug/banners" element={<AdminBanners />} />
        <Route path="/admin/:storeSlug/vendas" element={<AdminSales />} />
        <Route path="/admin/:storeSlug/estoque" element={<AdminStock />} />
        <Route path="/admin/:storeSlug/financeiro" element={<AdminFinancial />} />
        <Route path="/admin/:storeSlug/vendedores" element={<AdminVendedores />} />
      </Routes>

      {!window.location.pathname.startsWith('/admin') &&
       !window.location.pathname.startsWith('/orby-admin') &&
       window.location.pathname !== '/' && <Footer />}
    </BrowserRouter>
  )
}

export default App