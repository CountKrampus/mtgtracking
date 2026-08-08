import React, { Suspense } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import ChunkErrorBoundary from '../components/ChunkErrorBoundary';
import SharedDeckView from '../components/CommunityDecks/SharedDeckView';
import CommunityDecks from '../components/CommunityDecks/CommunityDecks';
import ForumView from '../components/ForumView';
import MessagesPage from '../components/MessagesPage';
import MyProfile from '../components/MyProfile';
import UserProfile from '../components/UserProfile';
import SettingsView from '../components/SettingsView';
import lazyWithRetry from '../utils/lazyWithRetry';

const DeckBuilder = React.lazy(() => import('../components/DeckBuilder'));
const LifeCounter = React.lazy(() => import('../components/LifeCounter/LifeCounter'));
const Dashboard = lazyWithRetry(() => import('../components/Dashboard'), { retries: 2, retryDelay: 600 });

const CardRulingsBrowser = React.lazy(() => import('../components/Learn/CardRulingsBrowser'));
const InteractionChecker = React.lazy(() => import('../components/Learn/InteractionChecker'));
const NewPlayerGuide = React.lazy(() => import('../components/Learn/NewPlayerGuide'));
const KeywordGlossary = React.lazy(() => import('../components/Learn/KeywordGlossary'));
const ComboTutorials = React.lazy(() => import('../components/Learn/ComboTutorials'));
const FormatGuides = React.lazy(() => import('../components/Learn/FormatGuides'));

const SealedSimulator = React.lazy(() => import('../components/Gameplay/SealedSimulator'));
const ArchenemyMode = React.lazy(() => import('../components/Gameplay/ArchenemyMode'));
const StarVariant = React.lazy(() => import('../components/Gameplay/StarVariant'));
const PlanechaseMode = React.lazy(() => import('../components/Gameplay/PlanechaseMode'));
const CustomFormatBuilder = React.lazy(() => import('../components/Gameplay/CustomFormatBuilder'));
const CubeBuilder = React.lazy(() => import('../components/Gameplay/CubeBuilder'));

const ReprintTracker = React.lazy(() => import('../components/Tools/ReprintTracker'));
const SetReleaseCalendar = React.lazy(() => import('../components/Tools/SetReleaseCalendar'));
const SpoilerSeasonIntegration = React.lazy(() => import('../components/Tools/SpoilerSeasonIntegration'));

const CollectionView = React.lazy(() => import('../components/CollectionView'));
const WishlistView = React.lazy(() => import('../components/WishlistView'));
const CollectionHealthReportView = React.lazy(() => import('../components/CollectionHealthReportView'));
const TradingBoard = React.lazy(() => import('../components/TradingBoard'));
const ChallengesView = React.lazy(() => import('../components/ChallengesView'));

function SharedDeckViewRoute() {
  const { shareCode } = useParams();
  return <SharedDeckView shareCode={shareCode} />;
}

function UserProfileRoute({ onBack }) {
  const { username } = useParams();
  return <UserProfile username={username} onBack={onBack} />;
}

function LoadingFallback() {
  return <div className="flex items-center justify-center h-full text-white/50">Loading...</div>;
}

export default function AppRoutes({
  cards, totalCards, totalValue, ignoredValue, formatPrice,
  navigate, fileInputRef, isImporting, setIsImporting,
  importProgress, setImportProgress, importResults, setImportResults,
  showImportResults, setShowImportResults,
  authUser, settings, updateSettings, resetSettings,
  locations, availableTags, locationStats,
  newLocationName, setNewLocationName, newLocationDesc, setNewLocationDesc,
  newLocationCapacity, setNewLocationCapacity,
  editingLocation, handleCreateLocation, handleUpdateLocation, cancelEditLocation,
  startEditLocation, handleDeleteLocation, handleToggleLocationIgnorePrice,
  newTagName, setNewTagName, handleCreateTag, handleDeleteTag, handleToggleTagIgnorePrice,
}) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/dashboard" element={
        <ChunkErrorBoundary>
          <Suspense fallback={<LoadingFallback />}>
            <Dashboard
              cards={cards}
              totalCards={totalCards}
              totalValue={totalValue}
              ignoredValue={ignoredValue}
              onAddCard={() => navigate('/collection')}
              onImport={() => fileInputRef.current?.click()}
              onUpdatePrices={() => navigate('/collection?tool=priceUpdate')}
              fileInputRef={fileInputRef}
              isImporting={isImporting}
              formatPrice={formatPrice}
            />
          </Suspense>
        </ChunkErrorBoundary>
      } />

      <Route path="/collection" element={
        <Suspense fallback={<LoadingFallback />}>
          <CollectionView
            fileInputRef={fileInputRef}
            isImporting={isImporting} setIsImporting={setIsImporting}
            importProgress={importProgress} setImportProgress={setImportProgress}
            importResults={importResults} setImportResults={setImportResults}
            showImportResults={showImportResults} setShowImportResults={setShowImportResults}
          />
        </Suspense>
      } />

      <Route path="/wishlist" element={
        <Suspense fallback={<LoadingFallback />}><WishlistView /></Suspense>
      } />

      <Route path="/health-report" element={
        <Suspense fallback={<LoadingFallback />}><CollectionHealthReportView /></Suspense>
      } />

      <Route path="/trades" element={
        <Suspense fallback={<LoadingFallback />}><TradingBoard /></Suspense>
      } />

      <Route path="/challenges" element={
        <Suspense fallback={<LoadingFallback />}><ChallengesView /></Suspense>
      } />

      <Route path="/decks" element={
        <Suspense fallback={<LoadingFallback />}><DeckBuilder /></Suspense>
      } />

      <Route path="/lifecounter" element={
        <Suspense fallback={<LoadingFallback />}><LifeCounter onBack={() => navigate('/dashboard')} /></Suspense>
      } />

      <Route path="/settings" element={
        <SettingsView
          settings={settings}
          updateSettings={updateSettings}
          resetSettings={resetSettings}
          formatPrice={formatPrice}
          locations={locations}
          availableTags={availableTags}
          locationStats={locationStats}
          newLocationName={newLocationName}
          setNewLocationName={setNewLocationName}
          newLocationDesc={newLocationDesc}
          setNewLocationDesc={setNewLocationDesc}
          newLocationCapacity={newLocationCapacity}
          setNewLocationCapacity={setNewLocationCapacity}
          editingLocation={editingLocation}
          handleCreateLocation={handleCreateLocation}
          handleUpdateLocation={handleUpdateLocation}
          cancelEditLocation={cancelEditLocation}
          startEditLocation={startEditLocation}
          handleDeleteLocation={handleDeleteLocation}
          handleToggleLocationIgnorePrice={handleToggleLocationIgnorePrice}
          newTagName={newTagName}
          setNewTagName={setNewTagName}
          handleCreateTag={handleCreateTag}
          handleDeleteTag={handleDeleteTag}
          handleToggleTagIgnorePrice={handleToggleTagIgnorePrice}
        />
      } />

      <Route path="/messages" element={
        authUser ? <MessagesPage user={authUser} onBack={() => navigate('/dashboard')} /> : <Navigate to="/dashboard" replace />
      } />

      <Route path="/profile" element={
        authUser ? <MyProfile user={authUser} onBack={() => navigate('/dashboard')} /> : <Navigate to="/dashboard" replace />
      } />

      <Route path="/u/:username" element={
        authUser ? <UserProfileRoute onBack={() => navigate('/dashboard')} /> : <Navigate to="/dashboard" replace />
      } />

      <Route path="/forum/*" element={<ForumView />} />

      <Route path="/community-decks" element={<CommunityDecks />} />

      <Route path="/learn/card-rulings" element={<Suspense fallback={<LoadingFallback />}><CardRulingsBrowser /></Suspense>} />
      <Route path="/learn/interaction-checker" element={<Suspense fallback={<LoadingFallback />}><InteractionChecker /></Suspense>} />
      <Route path="/learn/new-player-guide" element={<Suspense fallback={<LoadingFallback />}><NewPlayerGuide /></Suspense>} />
      <Route path="/learn/keyword-glossary" element={<Suspense fallback={<LoadingFallback />}><KeywordGlossary /></Suspense>} />
      <Route path="/learn/combo-tutorials" element={<Suspense fallback={<LoadingFallback />}><ComboTutorials /></Suspense>} />
      <Route path="/learn/format-guides" element={<Suspense fallback={<LoadingFallback />}><FormatGuides /></Suspense>} />

      <Route path="/play/sealed-simulator" element={<Suspense fallback={<LoadingFallback />}><SealedSimulator /></Suspense>} />
      <Route path="/play/archenemy" element={<Suspense fallback={<LoadingFallback />}><ArchenemyMode /></Suspense>} />
      <Route path="/play/star-variant" element={<Suspense fallback={<LoadingFallback />}><StarVariant /></Suspense>} />
      <Route path="/play/planechase" element={<Suspense fallback={<LoadingFallback />}><PlanechaseMode /></Suspense>} />
      <Route path="/play/custom-format" element={<Suspense fallback={<LoadingFallback />}><CustomFormatBuilder /></Suspense>} />

      <Route path="/tools/cube-builder" element={<Suspense fallback={<LoadingFallback />}><CubeBuilder /></Suspense>} />
      <Route path="/tools/reprint-tracker" element={<Suspense fallback={<LoadingFallback />}><ReprintTracker /></Suspense>} />
      <Route path="/tools/set-calendar" element={<Suspense fallback={<LoadingFallback />}><SetReleaseCalendar /></Suspense>} />
      <Route path="/tools/spoilers" element={<Suspense fallback={<LoadingFallback />}><SpoilerSeasonIntegration /></Suspense>} />

      <Route path="/shared/deck/:shareCode" element={<SharedDeckViewRoute />} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
