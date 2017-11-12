import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams, Platform, ToastController } from 'ionic-angular';
import { Http } from '@angular/http';
import { FCM } from '@ionic-native/fcm';
import { AngularFireAuth } from 'angularfire2/auth';
import { Observable, Subject } from 'rxjs';
import { NotificationSettingProvider } from '../../providers/notification-setting/notification-setting';
import { CompanyProvider } from '../../providers/company/company';

/**
 * Generated class for the ListTopicsPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-list-topics',
  templateUrl: 'list-topics.html',
})
export class ListTopicsPage {
  listCodeAsync: Observable<any[]>;
  loading: Observable<boolean>;
  code: string;

  readonly OPS = {
    add: (acc, val) => acc.concat(val),
    del: (acc, val) => acc.filter(b => b !== val),
  };

  private getOps(key: string): (acc: string[], val: string) => string[] {
    if (this.OPS[key]) return this.OPS[key];
    throw "no such key";
  }

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private nsp: NotificationSettingProvider,
    private toastCtrl: ToastController,
    private cp: CompanyProvider,
  ) {

    this.listCodeAsync = this.nsp.list$
    .map(s => 
      s.map(e => {
        return {
          id: e,
          data: this.cp.byCode(e)
        }
      })
    );
    this.loading = this.nsp.list$.map(() => false).startWith(true);
    this.nsp.list$.subscribe(e => console.log(e), (err) => {
      console.error(err);
      this.toastCtrl.create({message: JSON.stringify(err) }).present();
    })
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad ListTopicsPage');
  }

  delete(item) { 
    console.log(item);
    this.nsp.delete(item);
  }

  add() {
    if (!this.code) { return; }
    this.nsp.add(this.code.toString());
    this.code = "";
  }

}
