import { Component, ChangeDetectorRef, ViewChild } from '@angular/core';
import { IonicPage, NavController, NavParams, Platform, AlertController, LoadingController, PopoverController, ScrollEvent } from 'ionic-angular';
import { DisclosureProvider } from "../../providers/disclosure/disclosure";
import { Observable, Subject, BehaviorSubject } from "rxjs";
import { DocumentViewPage } from '../document-view/document-view';
import * as moment from 'moment';
import { SearchStocksPage } from '../search-stocks/search-stocks';
// import { DocumentViewer } from '@ionic-native/document-viewer';
import { FileOpener } from '@ionic-native/file-opener';
import { FileTransfer, FileTransferObject } from '@ionic-native/file-transfer';
import { File } from '@ionic-native/file';
import { FirebaseApp } from 'angularfire2';

import 'rxjs/add/operator/mergeMap'
import { PopoverFunnelPage } from '../popover-funnel/popover-funnel';
import { Content } from 'ionic-angular';
import { SettingsProvider } from '../../providers/settings/settings';
import { Disclosure } from '../../model/Disclosure';

/**
 * Generated class for the DocumentStreamPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage({
  priority: 'high',
})
@Component({
  selector: 'page-document-stream',
  templateUrl: 'document-stream.html',
})
export class DocumentStreamPage {

  items: Observable<Disclosure[]>;
  itemsAsync: Disclosure[] = [];
  date: string;
  documentViewPage = DocumentViewPage;
  searchStocksPage = SearchStocksPage;
  fileTransfer: FileTransferObject;
  loading: Observable<boolean>;
  headerScroll: number = 0;

  filterConditions: any = {};
  changeTag$ = new BehaviorSubject<any>({});

  object = Object;

  @ViewChild(Content)
  content: Content;

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private dp: DisclosureProvider,
    private platform: Platform,
    private fileOpener: FileOpener,
    private app: FirebaseApp,
    private alertCtrl: AlertController,
    private transfer: FileTransfer,
    private file: File,
    private loadingCtrl: LoadingController,
    private popoverCtrl: PopoverController,
    private sp: SettingsProvider,
  ) {
    this.date = moment().format("YYYY-MM-DD");
    this.updateItems();
  }

  ionViewDidLoad() {
    if(this.platform.is('cordova')) {
      this.platform.ready().then(() => {
        this.fileTransfer = this.transfer.create();
      })
    }
    console.log('ionViewDidLoad DocumentStreamPage');
  }

  onChangeDate() {
    console.log(this.date);
    this.clearItems();
    this.content.scrollToTop();
    this.updateItems();
  }

  onScroll(ev: ScrollEvent) {
    ev.domWrite(() => {
      this.headerScroll = this.headerScroll + ev.velocityY;
      if (this.headerScroll > 0) this.headerScroll = 0;
      else if (this.headerScroll < -48) this.headerScroll = -48;
      ev.headerElement.style.transform = `translateY(${this.headerScroll}px)`;
    });
  }

  addTag(tag) {
    this.filterConditions[tag] = true;
    this.changeTag$.next(Object.assign({}, this.filterConditions));
  }

  private clearItems() {
    this.itemsAsync = [];
  }

  private updateItems() {
    const share = this.dp.by_date(this.date).share(); 
    this.items = Observable.combineLatest(
      share,
      this.changeTag$.asObservable(),
      this.sp.get()
    ).map(([docs, tags, st]) => {
      const tagList = Object.keys(tags).filter(e => tags[e]);
      let f1, f2;
      if(tagList.length === 0) {
        f1 = docs;
        // return this.itemsAsync;
      } else {
        f1 = <any>docs.filter((doc: any) => tagList.some(tag => doc.tags && doc.tags[tag]))
      }

      if (st.hideDailyDisclosure)  {
        f2 = f1.filter((doc: any) => !doc.tags || (doc.tags && doc.tags["日々の開示事項"] != true))
      } else {
        f2 = f1;
      }

      this.itemsAsync = f2;
      return this.itemsAsync;
    });
    this.loading  = share.map(() => false).startWith(true);
  }

  virtualTrack(index, item) {
    // console.log("virtual track", index, item);
    return item.document;
  }

  onFunnelClick(ev: UIEvent) {
    this.sp.setting$.subscribe(s => {
      let popover = this.popoverCtrl.create(PopoverFunnelPage, {
        tags: ['株主優待', '決算', '配当', '業績予想', '日々の開示事項'],
        tagCtrl: this.filterConditions,
        change$: this.changeTag$,
        disabled: {'日々の開示事項': s.hideDailyDisclosure}
      })
      return popover.present({ev: ev});
    })
  }

  viewDocument(item: Disclosure) {
    console.log(item, item.documentPath());
    if(this.platform.is('cordova')) {
      const loading = this.loadingCtrl.create({
        content: 'ファイルをダウンロード中',
        enableBackdropDismiss: true,
        dismissOnPageChange: true,
      })
      loading.present();
      const viewDoc$ = Observable.fromPromise(this.app.storage().ref().child(item.documentPath()).getDownloadURL())
      .do(e => console.log(e))
      .mergeMap(url => this.fileTransfer.download(url, this.file.dataDirectory + item.document + '.pdf'))
      .catch(err => {
        let alert = this.alertCtrl.create({
          title: 'Error',
          subTitle: err.message,
          buttons: ['Dismiss'],
        });
        loading.dismiss()
        alert.present();
        throw err;
      })
      .subscribe(entry => {
        console.log(entry.toURL());
        loading.dismiss()
        this.fileOpener.open(entry.toURL(), 'application/pdf');
      })
      // loading.onWillDismiss(() => viewDoc$.unsubscribe());

    } else {
      this.navCtrl.push(DocumentViewPage, item);
    }
  }

}
