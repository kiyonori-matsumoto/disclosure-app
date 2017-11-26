import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { ListTopicsPage } from '../list-topics/list-topics';
import { SettingsProvider, Setting } from '../../providers/settings/settings';
import { GooglePlus } from '@ionic-native/google-plus';
import * as firebase from 'firebase'
import { AngularFireAuth } from 'angularfire2/auth';
import { ToastController } from 'ionic-angular/components/toast/toast-controller';
import { AuthProvider } from '../../providers/auth/auth';
import { duration } from 'moment';

/**
 * Generated class for the SettingPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
  selector: 'page-setting',
  templateUrl: 'setting.html',
})
export class SettingPage {

  listTopicsPage = ListTopicsPage;
  settings: Setting = <Setting>{};

  constructor(
    public navCtrl: NavController,
    public navParams: NavParams,
    private sp: SettingsProvider,
    private googlePlus: GooglePlus,
    private afAuth: AngularFireAuth,
    private toastCtrl: ToastController,
    public  auth: AuthProvider,
  ) {
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad SettingPage');
    this.sp.get().subscribe(s => this.settings = s);
  }

  onSettingChange() {
    this.sp.update(this.settings)
    .subscribe(console.log);
  }

  onLinkToGoogleClick() {
    this.auth.linkToGoogle()
    .then(() => 
      this.toastCtrl.create({message: 'アカウント連携が完了しました', duration: 5000}).present()
    )
    .catch((err) => {
      console.error(err);
      this.toastCtrl.create({message: err.message || err.code || err, showCloseButton: true}).present()
    })
  }

  onDisconnectFromGoogleClick() {
    this.auth.unlinkFromGoogle()
    .then(() => 
      this.toastCtrl.create({message: 'アカウント連携を解除しました', duration: 5000}).present()
    )
    .catch((err) => {
      console.error(err);
      this.toastCtrl.create({message: err.message || err.code || err, showCloseButton: true}).present()
    })
  }
}
