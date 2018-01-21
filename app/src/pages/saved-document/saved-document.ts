import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams, Platform, AlertController, LoadingController, ToastController } from 'ionic-angular';
import { Observable } from 'rxjs';
import { DisclosureProvider } from '../../providers/disclosure/disclosure';
import { FirebaseApp } from 'angularfire2';
import { CompanyProvider } from '../../providers/company/company';
import { NotificationSettingProvider } from '../../providers/notification-setting/notification-setting';
import { SettingsProvider } from '../../providers/settings/settings';
import { FavoriteProvider } from '../../providers/favorite/favorite';
import { DocumentViewerProvider } from '../../providers/document-viewer/document-viewer';
import { Disclosure } from '../../model/Disclosure';
import { DocumentBoxProvider } from '../../providers/document-box/document-box';

import * as moment from 'moment'

/**
 * Generated class for the SavedDocumentPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-saved-document',
  templateUrl: 'saved-document.html',
})
export class SavedDocumentPage {
  items: Disclosure[];
  loading: Observable<boolean>;

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private dp: DisclosureProvider,
    private platform: Platform,
    private app: FirebaseApp,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private documentViewer: DocumentViewerProvider,
    private documentBox: DocumentBoxProvider,
  ) {

  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad SavedDocumentPage');
    this.loading = this.documentBox.documentBox$.mapTo(false).startWith(true);
    this.documentBox.documentBox$.subscribe(items => {
      items = items.map(i => {
        i.add_at = moment(i.add_at || 0).format('L')
        return i;
      })
      this.items = items;
    })
  }

  viewDocument(item) {
    this.documentViewer.viewDisclosure(this.navCtrl, item);
  }

  delete(id: string) {
    this.documentBox.delete(id).subscribe(console.log)
  }

  virtualScrollHeader(record, recordIndex, records) {
    if (recordIndex === 0 || record.add_at !== records[recordIndex - 1].add_at) {
      return record.add_at;
    }
    return null;
  }

}
