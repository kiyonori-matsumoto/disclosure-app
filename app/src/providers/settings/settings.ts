import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import { AngularFirestore } from 'angularfire2/firestore';
import { AngularFireAuth } from 'angularfire2/auth';
import { Observable, Subject, ReplaySubject } from 'rxjs';

/*
  Generated class for the SettingsProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class SettingsProvider {

  private readonly settingSubject = new ReplaySubject<Setting>(1);
  public readonly setting$: Observable<Setting> = this.settingSubject.asObservable();

  constructor(private afs: AngularFirestore, private afAuth: AngularFireAuth) {
    console.log('Hello SettingsProvider Provider');
    this.afAuth.authState
    .filter(user => !!user)
    .map(user => user.uid)
    .mergeMap(uid => this.ref(uid).get())
    .map(doc => doc.exists ? <Setting>doc.data().setting : <Setting>{})
    .subscribe(this.settingSubject);
  }

  private ref(uid) {
    return this.afs.collection('users').doc(uid).ref;
  }

  public get() {
    return this.setting$;
  }

  public update(setting: Setting) {
    const s = Object.assign({}, setting);
    this.settingSubject.next(setting);
    return this.afAuth.authState
    .map(user => user.uid)
    .mergeMap(uid => this.ref(uid).set({
      setting: s
    }, {merge: true}))
  }
}

export interface Setting {
  hideDailyDisclosure: boolean;
}
