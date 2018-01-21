import { Component, OnInit } from '@angular/core';
import { IonicPage, NavController, NavParams, Platform, AlertController, LoadingController, ToastController } from 'ionic-angular';
import 'rxjs/add/operator/take'
import 'rxjs/add/operator/map'
import 'rxjs/add/operator/mergeMap'
import { DisclosureProvider } from "../../providers/disclosure/disclosure";
import { Observable, Subject, AsyncSubject, BehaviorSubject } from "rxjs";
import { DocumentViewPage } from "../document-view/document-view";
import * as firebase from 'firebase';
import { FileOpener } from '@ionic-native/file-opener';
import { FirebaseApp } from 'angularfire2';
import { FileTransfer, FileTransferObject } from '@ionic-native/file-transfer';
import { File } from '@ionic-native/file';
import { CompanyProvider } from '../../providers/company/company';
import { NotificationSettingProvider } from '../../providers/notification-setting/notification-setting';
import { SettingsProvider } from '../../providers/settings/settings';
import { FavoriteProvider } from '../../providers/favorite/favorite';
import { DocumentViewerProvider } from '../../providers/document-viewer/document-viewer';
import { Disclosure } from '../../model/Disclosure';

/**
 * Generated class for the DocumentListPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-document-list',
  templateUrl: 'document-list.html',
})
export class DocumentListPage {
  // private readonly REF_BASE = 'disclosures';
  private readonly ITEMS_PER_PAGE = 10;

  pointer: any = '';
  code: string;
  companyName: Observable<string>;

  items : any[] = []

  isFavorite: Observable<boolean>;
  isNotification: Observable<boolean>;

  getfn;

  updateItems = e => {
    const val = e.docs.map(d => d.data() );
    this.items.push(... Object.keys(val).map(key => val[key]).sort((a, b) => b.time - a.time));
    this.pointer = e.docs[e.docs.length-1];
  }

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private dp: DisclosureProvider,
    private platform: Platform,
    private app: FirebaseApp,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    public cp: CompanyProvider,
    private nsp: NotificationSettingProvider,
    private sp: SettingsProvider,
    private fp: FavoriteProvider,
    private toastCtrl: ToastController,
    private documentViewer: DocumentViewerProvider,
  ) {
    this.code = navParams.get('code');
    this.getfn = this.dp.get;
    this.dp.get(navParams.get('code')).then(this.updateItems);
  }
  
  doInfinite(infiniteScroll) {
    console.log('doInfinite');
    this.dp.get(this.navParams.get('code'), this.ITEMS_PER_PAGE, this.pointer).then((snapshot) => {
      this.updateItems(snapshot);
      if(snapshot.size < this.ITEMS_PER_PAGE) { infiniteScroll.enable(false); }
      infiniteScroll.complete();
    });
  }

  doRefresh(refresh) {
    console.log('doRefresh');
    this.dp.get(this.navParams.get('code'), this.ITEMS_PER_PAGE).then((snapshot) => {
      this.items = [];
      this.updateItems(snapshot);
      refresh.complete();
    });
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad DocumentListPage');
    this.isFavorite = this.fp.favorite$.do(e => console.log(`favorites = ${e}`)).map(e => e.some(f => f === this.code));
    this.isNotification = this.nsp.list$.do(e => console.log(`nsp = ${e}`)).map(e => e.some(f => f === this.code))
    this.companyName = this.cp.byCode(this.code).map(e => e.name);
    // this.nsp.list$.subscribe(e => console.log(e), (err) => {
    //   console.error(err);  
    // })
    this.fp.favorite$.subscribe(e => console.log(e), (err) => {
      console.error(err);  
    })
  }

  changeNotifications() {
    this.nsp.switch(this.code);
  }

  changeFavorite() {
    this.fp.switch(this.code).subscribe(d => {
      console.log(d);
      this.toastCtrl.create({message: 'お気に入り設定を変更しました', duration: 3000}).present();
    });
  }

  viewDocument(item: Disclosure) {
    this.documentViewer.viewDisclosure(this.navCtrl, item);
  }

}
