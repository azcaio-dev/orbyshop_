import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import ProductDetails from './pages/ProductDetails'
import OrderSummary from './pages/OrderSummary'
import AdminLogin from './pages/AdminLogin'
import AdminProducts from './pages/AdminProducts'
import AdminBulkImport from './pages/AdminBulkImport.jsx'
import AdminBanners from './pages/AdminBanners'
import AdminSettings from './pages/AdminSettings'
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
import { getStoreSlugFromDomain } from './config/customDomains'
import AvaliarLoja from './pages/AvaliarLoja.jsx'
import AdminReviews from './pages/AdminReviews'

function App() {
  // Se o domínio atual estiver mapeado (ex: calcarbem.app.br), a raiz "/"
  // deve abrir direto a loja correspondente, em vez da Landing da Orby.
  const customDomainSlug = getStoreSlugFromDomain()

  return (
    <BrowserRouter>
      <ScrollToTop />

      <Routes>
        <Route path="/orby-admin/dashboard" element={<OrbyAdminDashboard />} />
        <Route path="/orby-admin/criar-loja" element={<OrbyCreateStore />} />
        <Route path="/orby-admin/editar-loja/:storeSlug" element={<OrbyEditStore />} />

        <Route path="/" element={customDomainSlug ? <Home /> : <Landing />} />
        <Route path="/:storeSlug" element={<Home />} />

        <Route path="/produtos" element={<Products />} />
        <Route path="/:storeSlug/produtos" element={<Products />} />

        <Route path="/:storeSlug/avaliar/:reviewToken" element={<AvaliarLoja />} />
        <Route path="/admin/:storeSlug/avaliacoes" element={<AdminReviews />} />
        <Route path="/avaliar/:reviewToken" element={<AvaliarLoja />} />
        <Route path="/:storeSlug/avaliar/:reviewToken" element={<AvaliarLoja />} /> 

        <Route path="/produto/:id" element={<ProductDetails />} />
        <Route path="/:storeSlug/produto/:id" element={<ProductDetails />} />

        <Route path="/pedido/:orderId" element={<OrderSummary />} />
        <Route path="/:storeSlug/pedido/:orderId" element={<OrderSummary />} />

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLogin />} />

        <Route path="/admin/:storeSlug/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/:storeSlug/produtos" element={<AdminProducts />} />
        <Route path="/admin/:storeSlug/cadastro-em-massa" element={<AdminBulkImport />} />
        <Route path="/admin/:storeSlug/banners" element={<AdminBanners />} />
        <Route path="/admin/:storeSlug/configuracoes" element={<AdminSettings />} />
        <Route path="/admin/:storeSlug/vendas" element={<AdminSales />} />
        <Route path="/admin/:storeSlug/estoque" element={<AdminStock />} />
        <Route path="/admin/:storeSlug/financeiro" element={<AdminFinancial />} />
        <Route path="/admin/:storeSlug/vendedores" element={<AdminVendedores />} />
      </Routes>

      {!window.location.pathname.startsWith('/admin') &&
       !window.location.pathname.startsWith('/orby-admin') &&
       (window.location.pathname !== '/' || customDomainSlug) && <Footer />}
    </BrowserRouter>
  )
}

export default App