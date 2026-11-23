import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useNavigate, useParams } from 'react-router'
import Header from './components/Header.jsx'
import TabBar from './components/TabBar.jsx'
import { DataProvider, useData } from './lib/data.jsx'
import { useAuthUser } from './lib/auth.js'
import { LangProvider, resolveLang } from './lib/i18n.jsx'
import ActivityPage from './pages/ActivityPage.jsx'
import CheckPage from './pages/CheckPage.jsx'
import CheckDuePage from './pages/CheckDuePage.jsx'
import DuplicatesPage from './pages/DuplicatesPage.jsx'
import UnsortedPage from './pages/UnsortedPage.jsx'
import GonePage from './pages/GonePage.jsx'
import RepairsPage from './pages/RepairsPage.jsx'
import SetupPage from './pages/SetupPage.jsx'
import SweepPage from './pages/SweepPage.jsx'
import NamePage from './pages/NamePage.jsx'
import MissionsPage from './pages/MissionsPage.jsx'
import HuntPage from './pages/HuntPage.jsx'
import AsksPage from './pages/AsksPage.jsx'
import EssentialsPage from './pages/EssentialsPage.jsx'
import QuizPage from './pages/QuizPage.jsx'
import MePage from './pages/MePage.jsx'
import DeclutterPage from './pages/DeclutterPage.jsx'
import StatsPage from './pages/StatsPage.jsx'
import StockPage from './pages/StockPage.jsx'
import StockCheckPage from './pages/StockCheckPage.jsx'
import ShoppingPage from './pages/ShoppingPage.jsx'
import AiAddPage from './pages/AiAddPage.jsx'
import ImportPage from './pages/ImportPage.jsx'
import ListPage from './pages/ListPage.jsx'
import ListsPage from './pages/ListsPage.jsx'
import MaintenancePage from './pages/MaintenancePage.jsx'
import MissingPage from './pages/MissingPage.jsx'
import ExpiringPage from './pages/ExpiringPage.jsx'
import MisplacedPage from './pages/MisplacedPage.jsx'
import PrintPage from './pages/PrintPage.jsx'
import TrashPage from './pages/TrashPage.jsx'
import ItemPage from './pages/ItemPage.jsx'
import LabelPage from './pages/LabelPage.jsx'
import LabelsPage from './pages/LabelsPage.jsx'
import LentPage from './pages/LentPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import MapPage from './pages/MapPage.jsx'
import MorePage from './pages/MorePage.jsx'
import PlacePage from './pages/PlacePage.jsx'
import HomePage from './pages/HomePage.jsx'
import QuickAdd from './pages/QuickAdd.jsx'
import SearchPage from './pages/SearchPage.jsx'
import MissesPage from './pages/MissesPage.jsx'
import BatteriesPage from './pages/BatteriesPage.jsx'
import SalePage from './pages/SalePage.jsx'
import ClaimsPage from './pages/ClaimsPage.jsx'
import TagPage from './pages/TagPage.jsx'
import TagsPage from './pages/TagsPage.jsx'
import { t } from './lib/i18n.jsx'

// Remount per record so forms/modals don't carry over when navigating place → place.
function Keyed ({ page: Page }) {
  const { id } = useParams()
  return <Page key={id} />
}

// On a computer: "/" jumps to search from anywhere except while typing.
function SearchShortcut () {
  const navigate = useNavigate()
  useEffect(() => {
    const onKey = e => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return
      e.preventDefault()
      navigate('/search')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])
  return null
}

function LoadError () {
  const { error, reload } = useData()
  if (!error) return null
  return (
    <p className='error center'>
      {t('error.server', { error })} <button className='btn' onClick={reload}>{t('action.retry')}</button>
    </p>
  )
}

export default function App () {
  const user = useAuthUser()
  const lang = resolveLang(user?.language)
  // A scanned QR link survives the login screen because the URL is kept as-is.
  if (!user) return <LangProvider lang={lang}><LoginPage /></LangProvider>
  return (
    <LangProvider lang={lang}>
    <BrowserRouter>
      <DataProvider key={user.id}>
        <Header />
        <SearchShortcut />
        <main>
          <LoadError />
          <Routes>
            <Route path='/' element={<HomePage />} />
            <Route path='/p/:id' element={<Keyed page={PlacePage} />} />
            <Route path='/i/:id' element={<Keyed page={ItemPage} />} />
            <Route path='/add/:id' element={<Keyed page={QuickAdd} />} />
            <Route path='/map' element={<MapPage />} />
            <Route path='/map/:id' element={<MapPage />} />
            <Route path='/search' element={<SearchPage />} />
            <Route path='/activity' element={<ActivityPage />} />
            <Route path='/more' element={<MorePage />} />
            <Route path='/lent' element={<LentPage />} />
            <Route path='/low' element={<ShoppingPage />} />
            <Route path='/shopping' element={<ShoppingPage />} />
            <Route path='/stock' element={<StockPage />} />
            <Route path='/stock/check' element={<StockCheckPage />} />
            <Route path='/gone' element={<GonePage />} />
            <Route path='/repairs' element={<RepairsPage />} />
            <Route path='/setup' element={<SetupPage />} />
            <Route path='/sweep/:id' element={<Keyed page={SweepPage} />} />
            <Route path='/name' element={<NamePage />} />
            <Route path='/missions' element={<MissionsPage />} />
            <Route path='/hunt' element={<HuntPage />} />
            <Route path='/asks' element={<AsksPage />} />
            <Route path='/misses' element={<MissesPage />} />
            <Route path='/batteries' element={<BatteriesPage />} />
            <Route path='/sale' element={<SalePage />} />
            <Route path='/claims' element={<ClaimsPage />} />
            <Route path='/essentials' element={<EssentialsPage />} />
            <Route path='/quiz' element={<QuizPage />} />
            <Route path='/me' element={<MePage />} />
            <Route path='/declutter' element={<DeclutterPage />} />
            <Route path='/stats' element={<StatsPage />} />
            <Route path='/tags' element={<TagsPage />} />
            <Route path='/tags/:id' element={<Keyed page={TagPage} />} />
            <Route path='/misplaced' element={<MisplacedPage />} />
            <Route path='/expiring' element={<ExpiringPage />} />
            <Route path='/trash' element={<TrashPage />} />
            <Route path='/print/:id' element={<Keyed page={PrintPage} />} />
            <Route path='/check/:id' element={<Keyed page={CheckPage} />} />
            <Route path='/ai-add/:id' element={<Keyed page={AiAddPage} />} />
            <Route path='/lists' element={<ListsPage />} />
            <Route path='/lists/:id' element={<Keyed page={ListPage} />} />
            <Route path='/import' element={<ImportPage />} />
            <Route path='/unsorted' element={<UnsortedPage />} />
            <Route path='/checks' element={<CheckDuePage />} />
            <Route path='/duplicates' element={<DuplicatesPage />} />
            <Route path='/missing' element={<MissingPage />} />
            <Route path='/maintenance' element={<MaintenancePage />} />
            <Route path='/l/:code' element={<LabelPage />} />
            <Route path='/labels' element={<LabelsPage />} />
          </Routes>
        </main>
        <TabBar />
      </DataProvider>
    </BrowserRouter>
    </LangProvider>
  )
}
