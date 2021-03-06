import { Component, ChangeDetectorRef, ViewChild } from "@angular/core";
import {
  IonicPage,
  NavController,
  NavParams,
  Platform,
  AlertController,
  LoadingController,
  PopoverController,
  ScrollEvent
} from "ionic-angular";
import { DisclosureProvider } from "../../providers/disclosure/disclosure";
import { Observable, Subject, BehaviorSubject } from "rxjs";
import { DocumentViewPage } from "../document-view/document-view";
import * as moment from "moment";
import { SearchStocksPage } from "../search-stocks/search-stocks";
// import { DocumentViewer } from '@ionic-native/document-viewer';
import { FileOpener } from "@ionic-native/file-opener";
import { FileTransfer, FileTransferObject } from "@ionic-native/file-transfer";
import { File } from "@ionic-native/file";
import { Firebase } from "@ionic-native/firebase";
import { FirebaseApp } from "angularfire2";

import "rxjs/add/operator/mergeMap";
import { PopoverFunnelPage } from "../popover-funnel/popover-funnel";
import { Content, VirtualScroll, ToastController } from "ionic-angular";
import { SettingsProvider } from "../../providers/settings/settings";
import { Disclosure } from "../../model/Disclosure";
import { DocumentBoxProvider } from "../../providers/document-box/document-box";
import { DocumentViewerProvider } from "../../providers/document-viewer/document-viewer";
import { CustomTagsProvider } from "../../providers/custom-tags/custom-tags";

/**
 * Generated class for the DocumentStreamPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage({
  priority: "high"
})
@Component({
  selector: "page-document-stream",
  templateUrl: "document-stream.html"
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
  selectionCount: number = 0;

  filterConditions: any = {};
  changeTag$ = new BehaviorSubject<any>({});

  object = Object;

  @ViewChild(Content) content: Content;
  @ViewChild(VirtualScroll) vs: VirtualScroll;

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private dp: DisclosureProvider,
    private dbp: DocumentBoxProvider,
    private sp: SettingsProvider,
    private ctp: CustomTagsProvider,
    private platform: Platform,
    private app: FirebaseApp,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private popoverCtrl: PopoverController,
    private firebase: Firebase,
    private toastCtrl: ToastController,
    private documentViewer: DocumentViewerProvider
  ) {
    this.date = moment().format("YYYY-MM-DD");
  }

  ionViewDidLoad() {
    this.updateItems();
    // if(this.platform.is('cordova')) {
    // }
    console.log("ionViewDidLoad DocumentStreamPage");
  }

  onChangeDate() {
    console.log(this.date);
    this.clearItems();
    // this.content.scrollToTop();
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
    this.firebase
      .logEvent("documentStream", this.date.toString())
      .then(console.log, console.error);
    const share = this.dp.by_date(this.date).share();
    this.items = Observable.combineLatest(
      share,
      this.changeTag$.asObservable(),
      this.sp.get()
    )
      .map(([docs, tags, setting]) => {
        console.log(docs);
        const tagList = Object.keys(tags).filter(e => tags[e]);
        let f1, f2;
        if (tagList.length === 0) {
          f1 = docs;
          // return this.itemsAsync;
        } else {
          f1 = <any>docs.filter((doc: any) =>
            tagList.some(tag => doc.tags && doc.tags[tag])
          );
        }

        if (setting.hideDailyDisclosure) {
          f2 = f1.filter(
            (doc: any) =>
              !doc.tags || (doc.tags && doc.tags["日々の開示事項"] != true)
          );
        } else {
          f2 = f1;
        }
        this.itemsAsync = f2;
        // if (this.content) {
        //   this.content.scrollTo(0, 1, 0);
        // }
        return this.itemsAsync;
      })
      .catch(err => {
        console.error(err);
        this.alertCtrl
          .create({ message: err.message, title: "Error" })
          .present();
        // this.firebase.logError(JSON.stringify(err)).then(console.log);
        // this.platform.exitApp();
        return [];
      })
      .shareReplay(1);
    this.loading = share.map(() => false).startWith(true);
  }

  virtualTrack(index, item) {
    // console.log("virtual track", index, item);
    return item.document;
    // return Math.random().toString(16).slice(0, 10);
  }

  toggleExpand(event, item) {
    event.stopPropagation();
    item.expand = !item.expand;
  }

  onFunnelClick(ev: UIEvent) {
    Observable.combineLatest(this.sp.setting$.take(1), this.ctp.tag$).take(1).subscribe(
      ([s, tags]) => {
        let popover = this.popoverCtrl.create(PopoverFunnelPage, {
          tags: [
            "株主優待",
            "決算",
            "配当",
            "業績予想",
            "新株",
            "自己株式",
            "日々の開示事項"
          ].concat(tags),
          tagCtrl: this.filterConditions,
          change$: this.changeTag$,
          disabled: { 日々の開示事項: s.hideDailyDisclosure }
        });
        return popover.present({ ev: ev });
      }
    );
  }

  selectItem(item: Disclosure) {
    item.select = true;
    this.selectionCount++;
  }

  switchSelectItem(event, item: Disclosure) {
    item.select = !item.select;
    if (item.select) {
      // false to true
      this.selectionCount++;
    } else {
      this.selectionCount--;
    }
  }

  clearAllSelection() {
    this.itemsAsync
      .filter(e => e.select)
      .forEach(item => (item.select = false));
    this.selectionCount = 0;
  }

  saveToDocumentBox() {
    const saves = this.itemsAsync.filter(e => e.select).map(e =>
      this.dbp
        .add(
          e.document,
          Object.assign(
            {
              add_at: moment().valueOf()
            },
            e
          )
        )
        .toPromise()
    );

    Promise.all(saves)
      .then(() => {
        this.toastCtrl
          .create({ message: "保存しました", showCloseButton: true })
          .present();
        this.clearAllSelection();
      })
      .catch(err => {
        this.alertCtrl
          .create({ message: err.message, title: "ERROR" })
          .present();
      });
  }

  deselectItemOrViewDocument(event, item: Disclosure) {
    if (item.select) {
      item.select = false;
      this.selectionCount--;
    } else {
      this.viewDocument(event, item);
    }
  }

  viewDocument(event, item: Disclosure) {
    this.documentViewer.viewDisclosure(this.navCtrl, item);
  }
}
