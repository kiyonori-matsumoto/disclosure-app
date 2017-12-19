import { BrowserModule } from '@angular/platform-browser';
import { ErrorHandler, NgModule } from '@angular/core';
import { IonicApp, IonicErrorHandler, IonicModule } from 'ionic-angular';
import { SplashScreen } from '@ionic-native/splash-screen';
import { StatusBar } from '@ionic-native/status-bar';

import { MyApp } from './app.component';
import { HomePage } from '../pages/home/home';

import { AngularFireModule } from 'angularfire2';
import { AngularFireDatabaseModule } from 'angularfire2/database';
import { AngularFireAuthModule } from 'angularfire2/auth';
import { AngularFirestoreModule } from 'angularfire2/firestore';
import { DocumentListPage } from "../pages/document-list/document-list";
import { DocumentListPageModule } from "../pages/document-list/document-list.module";
import { DisclosureProvider } from '../providers/disclosure/disclosure';
import { DocumentViewPageModule } from "../pages/document-view/document-view.module";
import { DocumentViewPage } from "../pages/document-view/document-view";
import { SettingPageModule } from "../pages/setting/setting.module";
import { SettingPage } from "../pages/setting/setting";
import { SignInProvider } from '../providers/sign-in/sign-in';
import { AuthProvider } from '../providers/auth/auth';
import { DocumentStreamPage } from '../pages/document-stream/document-stream';
import { DocumentStreamPageModule } from '../pages/document-stream/document-stream.module';
import { TwitterTimePipe } from '../pipes/twitter-time/twitter-time';
import { ListTopicsPageModule } from '../pages/list-topics/list-topics.module';
import { ListTopicsPage } from '../pages/list-topics/list-topics';
import { SearchStocksPageModule } from '../pages/search-stocks/search-stocks.module';
import { SearchStocksPage } from '../pages/search-stocks/search-stocks';
import { FileTransfer } from '@ionic-native/file-transfer';
import { File } from '@ionic-native/file';
import { FileOpener } from '@ionic-native/file-opener';
import { PopoverFunnelPageModule } from '../pages/popover-funnel/popover-funnel.module';
import { PopoverFunnelPage } from '../pages/popover-funnel/popover-funnel';
import { SettingsProvider } from '../providers/settings/settings';
import { CompanyProvider } from '../providers/company/company';
import { Firebase } from '@ionic-native/firebase';
import { NotificationSettingProvider } from '../providers/notification-setting/notification-setting';
import { FavoriteProvider } from '../providers/favorite/favorite';
import { FavoritesPage } from '../pages/favorites/favorites';
import { FavoritesPageModule } from '../pages/favorites/favorites.module';
import { AdMobFree } from '@ionic-native/admob-free';
import { DocumentBoxProvider } from '../providers/document-box/document-box';
import { GooglePlus } from '@ionic-native/google-plus';

export const firebaseConfig = {
  apiKey: "AIzaSyALnFQtoerM7eH2dZm9ZPXhUvXo7bzZ2og",
  authDomain: "disclosure-app.firebaseapp.com",
  databaseURL: "https://disclosure-app.firebaseio.com",
  projectId: "disclosure-app",
  storageBucket: "disclosure-app.appspot.com",
  messagingSenderId: "1069938845824"
};

@NgModule({
  declarations: [
    MyApp,
    HomePage,
  ],
  imports: [
    BrowserModule,
    IonicModule.forRoot(MyApp),
    AngularFireModule.initializeApp(firebaseConfig),
    AngularFireDatabaseModule,
    AngularFireAuthModule,
    AngularFirestoreModule,
    DocumentListPageModule,
    DocumentStreamPageModule,
    DocumentViewPageModule,
    PopoverFunnelPageModule,
    ListTopicsPageModule,
    SettingPageModule,
    SearchStocksPageModule,
    FavoritesPageModule,
  ],
  bootstrap: [IonicApp],
  entryComponents: [
    MyApp,
    HomePage,
    DocumentListPage,
    DocumentStreamPage,
    DocumentViewPage,
    ListTopicsPage,
    SettingPage,
    SearchStocksPage,
    PopoverFunnelPage,
    FavoritesPage,
  ],
  providers: [
    StatusBar,
    SplashScreen,
    {provide: ErrorHandler, useClass: IonicErrorHandler},
    DisclosureProvider,
    SignInProvider,
    AuthProvider,
    Firebase,
    // DocumentViewer,
    FileOpener,
    FileTransfer,
    File,
    GooglePlus,
    SettingsProvider,
    CompanyProvider,
    NotificationSettingProvider,
    FavoriteProvider,
    AdMobFree,
    DocumentBoxProvider,
  ]
})
export class AppModule {}