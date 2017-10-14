import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import { AngularFirestore } from 'angularfire2/firestore';
import { AngularFireAuth } from 'angularfire2/auth';

/*
  Generated class for the SettingsProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class SettingsProvider {

  constructor(private afs: AngularFirestore, private afAuth: AngularFireAuth) {
    console.log('Hello SettingsProvider Provider');
  }

  public get() {
    return this.afAuth.authState
    .map(user => user.uid)
    .do(uid => console.log(uid))
    .mergeMap(uid => this.afs.collection('users').doc(uid).ref.get())
    .map(doc => doc.data().setting || {});
  }

}
