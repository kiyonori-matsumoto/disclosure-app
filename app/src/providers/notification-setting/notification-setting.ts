import { Injectable, OnInit } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import { FCM } from '@ionic-native/fcm';
import { Observable, Subject, AsyncSubject, BehaviorSubject, ReplaySubject } from 'rxjs';
import { Platform } from 'ionic-angular';

/*
  Generated class for the ConnectionSettingProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class NotificationSettingProvider implements OnInit {
  
  ngOnInit(): void {
    console.log('NotificationSettingProvider ngOnInit called')
  }

  private notifications: Set<string> = new Set();
  private notificationSubject: Subject<IterableIterator<string>> = new Subject();
  public readonly list$: Observable<string[]>;

  constructor(
    private http: Http,
    private fcm: FCM,
    private platform: Platform,
  ) {
    console.log('Hello NotificationSettingProvider Provider');
    this.list$ = this.notificationSubject
    .map(e => Array.from(e).map(e => this.toCode(e)))
    .do(e => console.log(e))
    .publishReplay(1).refCount();

    this.initialize();
  }

  public initialize() {
    this.notifications.clear();
    if(this.platform.is('cordova')) {
      return Observable.fromPromise(this.fcm.getToken())
      .mergeMap(token => this.http.post('https://us-central1-disclosure-app.cloudfunctions.net/listTopics', { IID_TOKEN: token}))
      .take(1)
      .map(e => {
        try {
          return e.json() || {}
        } catch(e) {
          console.error(e);
          return {};
        }
      })
      .do(data => console.log(`data = ${JSON.stringify(data)}`))
      .subscribe(e => {
        Object.keys(e.topics || {})
        .filter(e => e.match(/^code_/))
        .forEach(e => this.notifications.add(e));
        this.notificationSubject.next(this.notifications.values());
        console.log('finish subject');
      })
    } else {
      this.notificationSubject.next(this.notifications.values());;
    }
  }

  private toTopic(code) {
    return `code_${code}`;
  }

  private toCode(topic: string) {
    return topic.replace(/^code_/, '');
  }

  public add(code) {
    const s = this.toTopic(code);
    this.notifications.add(s);
    this.notificationSubject.next(this.notifications.values());
    return this.fcm.subscribeToTopic(s);
  }

  public delete(code) {
    const s = this.toTopic(code);
    this.notifications.delete(s);
    this.notificationSubject.next(this.notifications.values());
    return this.fcm.unsubscribeFromTopic(s);
  }

  public switch(code) {
    const s = this.toTopic(code);
    if (this.notifications.has(s)) {
      return this.delete(code);
    }
    return this.add(code);
  }
}
