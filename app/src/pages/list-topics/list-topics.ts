import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams, Platform } from 'ionic-angular';
import { Http } from '@angular/http';
import { FCM } from '@ionic-native/fcm';
import { AngularFireDatabase, FirebaseListObservable, FirebaseObjectObservable } from 'angularfire2/database';
import { AngularFireAuth } from 'angularfire2/auth';
import { Observable } from 'rxjs';

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

  db: FirebaseObjectObservable<any>;
  items: Observable<any[]>
  listCode: any[] = [];
  code: string;

  constructor(public navCtrl: NavController, public navParams: NavParams, private http: Http, private fcm: FCM, private afDb: AngularFireDatabase, private afAuth: AngularFireAuth, private platform: Platform) {
  }

  ionViewDidLoad() {
    console.log('ionViewDidLoad ListTopicsPage');
    // this.afAuth.authState
    // .subscribe(u => {
    //   console.log(u.uid);
    //   this.db = this.afDb.object(`/user/topics/${u.uid}`);
    //   this.items = this.db.map(obj => Object.keys(obj).filter(e => e));
    // })
    if(this.platform.is('cordova')) {
      this.fetchNewList();
    }
  }

  private fetchNewList() {
    this.fcm.getToken().then(token => {
      this.http.post('https://us-central1-disclosure-app.cloudfunctions.net/listTopics', { IID_TOKEN: token})
      .subscribe(e => {
        const data = e.json();
        this.listCode = 
          Object.keys(data.topics)
          .filter(e => e.match(/^code\_/))
          .map(e => {
            return {
              title: e.split('_')[1],
              topic: e,
            }
          })
      })
    });
  }

  delete(item) { 
    // this.db.update({ [topic]: null})
    // this.db.remove(key);
    this.listCode = this.listCode.filter(e => e.topic !== item.topic);
    this.fcm.unsubscribeFromTopic(item.topic)
    .then(console.log);
  }

  add() {
    if (!this.code) { return; }
    const topic = `code_${this.code.toString()}`;
    // this.db.update({[topic]: true});
    
    // this.db.push(topic);
    
    this.listCode.push({
      title: this.code.toString(),
      topic: topic,
    });
    this.fcm.subscribeToTopic(topic).then((l) => {
      console.log(l);
      this.code = "";
    });
  }

}
