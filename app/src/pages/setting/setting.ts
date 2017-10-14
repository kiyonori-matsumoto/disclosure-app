import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams } from 'ionic-angular';
import { ListTopicsPage } from '../list-topics/list-topics';
import { SettingsProvider } from '../../providers/settings/settings';

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
  settings: any = {};

  constructor(public navCtrl: NavController, public navParams: NavParams, private sp: SettingsProvider) {
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad SettingPage');
    // this.sp.get().subscribe(s => this.settings = s);
  }

}
