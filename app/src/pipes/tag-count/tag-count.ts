import { Pipe, PipeTransform } from '@angular/core';

/**
 * Generated class for the TagCountPipe pipe.
 *
 * See https://angular.io/api/core/Pipe for more info on Angular Pipes.
 */
@Pipe({
  name: 'tagCount',
})
export class TagCountPipe implements PipeTransform {
  /**
   * Takes a value and makes it lowercase.
   */
  transform(value: any, ...args) {
    return Object.keys(value || {}).filter(e => value[e]).length;
    // console.log('tagCount', value);
    // return Object.keys(value).length;
  }
}
