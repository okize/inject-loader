// @flow

import loaderUtils from 'loader-utils';
import createRequireStringRegex from './createRequireStringRegex';
import getAllModuleDependencies from './getAllModuleDependencies';

const __INJECTED_SOURCE_REGEX = new RegExp(/\$__INJECTED_SOURCE__;/);
const __WRAPPED_MODULE_DEPENDENCIES_REGEX = new RegExp(/\$__WRAPPED_MODULE_DEPENDENCIES__;/);
const __WRAPPED_MODULE_REPLACEMENT = '(__injection("$1") || require("$1"))';

type WebpackContext = {
  query: string,
  resourcePath: string
};

function __createInjectorFunction({query, resourcePath}: WebpackContext, source: string) {
  // const query = loaderUtils.parseQuery(querystring);
  const requireStringRegex = createRequireStringRegex(query);
  const wrappedModuleDependencies = getAllModuleDependencies(source, requireStringRegex);
  const dependencyInjectedSource = source.replace(requireStringRegex, __WRAPPED_MODULE_REPLACEMENT);

  if (wrappedModuleDependencies.length === 0)
    console.warn(`Inject Loader: The module you are trying to inject into (\`${resourcePath}\`) does not seem to have any dependencies, are you sure you want to do this?`);

  function __injectWrapper(__injections = {}) {
    const module = {exports: {}};
    const exports = module.exports;

    // $FlowIgnore
    const __wrappedModuleDependencies: Array<string> = $__WRAPPED_MODULE_DEPENDENCIES__;

    (function __validateInjection() {
      const injectionKeys = Object.keys(__injections);
      const invalidInjectionKeys = injectionKeys.filter(x => __wrappedModuleDependencies.indexOf(x) === -1)

      if (invalidInjectionKeys.length > 0)
        throw new Error(`One or more of the injections you passed in is invalid for the module you are attempting to inject into.

- Valid injection targets for this module are: ${__wrappedModuleDependencies.join(' ')}
- The following injections were passed in:     ${injectionKeys.join(' ')}
- The following injections are invalid:        ${invalidInjectionKeys.join(' ')}
`)
    })();

    function __injection(dependency: string): ?any {
      return (__injections.hasOwnProperty(dependency) ? __injections[dependency] : null);
    }

    /*!************************************************************************/
    (function() {
      // $FlowIgnore
      $__INJECTED_SOURCE__;
    })();
    /*!************************************************************************/

    return module.exports;
  }

  // lol.
  return `module.exports = ${__injectWrapper.toString()}`
    .replace(__INJECTED_SOURCE_REGEX, dependencyInjectedSource)
    .replace(__WRAPPED_MODULE_DEPENDENCIES_REGEX, `${JSON.stringify(wrappedModuleDependencies)};`);
}

module.exports = function inject(source: string): string {
  this.cacheable && this.cacheable();
  return __createInjectorFunction(this, source);
}
