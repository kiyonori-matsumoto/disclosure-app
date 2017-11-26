import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { ListTopicsPage } from '../list-topics/list-topics';
import { SettingsProvider, Setting } from '../../providers/settings/settings';
import { GooglePlus } from '@ionic-native/google-plus';
import * as firebase from 'firebase'
import { AngularFireAuth } from 'angularfire2/auth';
import { ToastController } from 'ionic-angular/components/toast/toast-controller';

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

  onGoogleLoginClick() {
    this.googlePlus.login({
      webClientId: '1069938845824-sp6urskq03e06h52lm0sgrq77t0nln28.apps.googleusercontent.com',
      offline: true
    })
    .then(res => {
      console.log(JSON.stringify(res));
      const idToken = res.idToken;
      const credential = firebase.auth.GoogleAuthProvider.credential(idToken);
      this.afAuth.auth.signInWithCredential(credential)
      .then((user: firebase.User) => {
        this.toastCtrl.create({message: `Welcome, ${user.displayName}`}).present({duration: 5000})
      })
    })
    .catch((err) => {
      console.error(err);
      this.toastCtrl.create({message: err.message || err.code || err, showCloseButton: true}).present()
    })
  }

}
