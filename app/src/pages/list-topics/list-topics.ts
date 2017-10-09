import { Component } from '@angular/core';
import { IonicPage, NavController, NavParams, Platform } from 'ionic-angular';
import { Http } from '@angular/http';
import { FCM } from '@ionic-native/fcm';
import { AngularFireAuth } from 'angularfire2/auth';
import { Observable, Subject } from 'rxjs';

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
  items: Observable<any[]>
  listCode: any[] = [];
  listCodeAsync: Observable<any[]>;
  loading: Observable<boolean>;
  code: string;
  addSubject: Subject<string>;
  deleteSubject: Subject<string>;
  initSubject: Subject<string>;

  readonly OPS = {
    add: (acc, val) => acc.concat(val),
    del: (acc, val) => acc.filter(b => b !== val),
  };

  private getOps(key: string): (acc: string[], val: string) => string[] {
    if (this.OPS[key]) return this.OPS[key];
    throw "no such key";
  }

  constructor(public navCtrl: NavController, public navParams: NavParams, private http: Http, private fcm: FCM, private afAuth: AngularFireAuth, private platform: Platform) {
    this.addSubject = new Subject<string>();
    this.deleteSubject = new Subject<string>();
    this.initSubject = new Subject<string>();

    const input = Observable.merge(
      this.addSubject.asObservable().map(e => { return {op: 'add', val: e}}),
      this.deleteSubject.asObservable().map(e => { return {op: 'del', val: e}}),
      this.initSubject.asObservable().map(e => { return {op: 'add', val: e}}),
    );
    const scan = input.scan((a: string[], e) => this.getOps(e.op)(a, e.val), []);
    this.listCodeAsync = scan.map(data => data.filter(e => e.match(/^code_/))
      .map(e => { return { title: e.split('_')[1], topic: e}})
    );
    

    this.addSubject.asObservable().mergeMap(e => this.fcm.subscribeToTopic(e))
    .subscribe(e => {
      console.log(e);
      this.code = "";
    }, console.error);
    this.deleteSubject.asObservable().mergeMap(e => this.fcm.unsubscribeFromTopic(e)).subscribe(console.log, console.error);

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
    // this.listCodeAsync = 
    const list = Observable.fromPromise(this.fcm.getToken())
      .mergeMap(token => this.http.post('https://us-central1-disclosure-app.cloudfunctions.net/listTopics', { IID_TOKEN: token}))
      .map(e => e.json() || {})
      .mergeMap(data => Object.keys(data.topics)
        .filter(e => e.match(/^code_/))
        .map(e => this.initSubject.next(e))
      ).share();

    this.loading = list.map(() => false).startWith(true);
    // this.fcm.getToken().then(token => {
    //   this.http.post('https://us-central1-disclosure-app.cloudfunctions.net/listTopics', { IID_TOKEN: token})
    //   .subscribe(e => {
    //     const data = e.json();
    //     this.listCode = 
    //       Object.keys(data.topics)
    //       .filter(e => e.match(/^code\_/))
    //       .map(e => {
    //         return {
    //           title: e.split('_')[1],
    //           topic: e,
    //         }
    //       })
    //   })
    // });
  }

  delete(item) { 
    console.log(item);
    this.deleteSubject.next(item);
    // this.db.update({ [topic]: null})
    // this.db.remove(key);
    // this.listCode = this.listCode.filter(e => e.topic !== item.topic);
    // this.fcm.unsubscribeFromTopic(item.topic)
    // .then(console.log);
  }

  add() {
    if (!this.code) { return; }
    const topic = `code_${this.code.toString()}`;
    
    this.addSubject.next(topic);

    // this.listCode.push({
    //   title: this.code.toString(),
    //   topic: topic,
    // });
    // this.fcm.subscribeToTopic(topic).then((l) => {
    //   console.log(l);
    //   this.code = "";
    // });
  }

}
