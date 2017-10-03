import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import { NavController, Platform } from 'ionic-angular';
import { FCM } from '@ionic-native/fcm';

/*
  Generated class for the FcmProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class FcmProvider {

  // constructor(private platform: Platform, /*private navCtrl: NavController,*/ private fcm: FCM) {
  //   console.log('Hello FcmProvider Provider');
  // //   platform.ready().then(d => {
  //     if(platform.is('cordova')) {
  
  //       this.fcm.onNotification().subscribe(data => {
  //         console.log(data);
  
  //         const code = data.code;
  //         console.log(code);
  //         navCtrl.push('DocumentListPage', { code });
  //       })
  //     }
  // //   })
  // }

}
