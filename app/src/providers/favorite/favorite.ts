import { Injectable } from '@angular/core';
import { Http } from '@angular/http';
import 'rxjs/add/operator/map';
import { AngularFirestore } from 'angularfire2/firestore';
import { AngularFireAuth } from 'angularfire2/auth';
import { Subject, ReplaySubject } from 'rxjs';
import { AuthProvider } from '../auth/auth';
import { Observable } from 'rxjs/Observable';

/*
  Generated class for the FavoriteProvider provider.

  See https://angular.io/guide/dependency-injection for more info on providers
  and Angular DI.
*/
@Injectable()
export class FavoriteProvider {

  private favorites: Set<string>;
  private favoriteSubject: Subject<IterableIterator<string>> = new Subject();
  public readonly favorite$: Observable<string[]>;
  private uid

  constructor(
    private afAuth: AngularFireAuth,
    private afs: AngularFirestore,
    private ap: AuthProvider,
  ) {
    console.log('Hello FavoriteProvider Provider');
    this.favorite$ = this.favoriteSubject
    .map(e => Array.from(e))
    .do(e => console.log(e))
    .publishReplay(1).refCount();

    this.afAuth.authState
    .filter(e => !!e)
    .mergeMap(u => this.ref(u.uid).get())
    .map(e => e.exists ? e.data().favorites : [])
    .subscribe((favorites: string[]) => {
      console.log(favorites);
      this.favorites = new Set(favorites);
      this.favoriteSubject.next(this.favorites.values())
    });

    this.ap.uid$.subscribe(uid => this.uid = uid)
  }

  private doc(uid) {
    return this.afs.collection('users').doc(uid);
  }

  private ref(uid) {
    return this.doc(uid).ref;
  }

  private update() {
    // return this.ap.uid$
    // .mergeMap(uid => this.ref(uid).set({favorites: Array.from(this.favorites.values())}, {merge: true}))
    return Observable.fromPromise(this.ref(this.uid).set({favorites: Array.from(this.favorites.values())}, {merge: true}))
  }

  public add(code: string) {
    if (!this.favorites) return Observable.of(null);
    this.favorites.add(code);
    this.favoriteSubject.next(this.favorites.values());
    return this.update();
  }

  public delete(code: string) {
    if (!this.favorites) return Observable.of(null);
    this.favorites.delete(code);
    this.favoriteSubject.next(this.favorites.values());
    return this.update();
  }

  public switch(code: string) {
    if (!this.favorites) return Observable.of(null);
    console.log(Array.from(this.favorites.values()))
    if (this.favorites.has(code)) {
      return this.delete(code);
    }
    return this.add(code);
  }

  public has$(code: string) {
    return this.favorite$.map(e => e.some(f => f === code))
  }
}
