import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { DomSanitizer } from "@angular/platform-browser";

/**
 * Generated class for the DocumentViewPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-document-view',
  templateUrl: 'document-view.html',
})
export class DocumentViewPage {

  document;
  documentUrl;

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    sanitizer: DomSanitizer,
  ) {
    this.document = navParams.data;
    this.documentUrl = sanitizer.bypassSecurityTrustResourceUrl(`https://docs.google.com/viewer?url=https://www.release.tdnet.info/inbs/${this.document.document}.pdf&embedded=true`)

  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad DocumentViewPage');
  }

}
