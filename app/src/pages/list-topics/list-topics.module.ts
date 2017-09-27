import { NgModule } from '@angular/core';
import { IonicPageModule } from 'ionic-angular';
import { ListTopicsPage } from './list-topics';
import { HttpModule } from '@angular/http';

@NgModule({
  declarations: [
    ListTopicsPage,
  ],
  imports: [
    IonicPageModule.forChild(ListTopicsPage),
    HttpModule,
  ],
})
export class ListTopicsPageModule {}
