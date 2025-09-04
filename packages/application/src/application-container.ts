import { Result, Ok, Err } from '@misc-poc/shared';
import { ApplicationConfig } from './application-config';

export type DependencyKey = string;
export type FactoryFunction<T = unknown> = (
  dependencies: Record<DependencyKey, unknown>
) => T;

export enum ServiceLifetime {
  SINGLETON = 'singleton',
  TRANSIENT = 'transient',
}

export interface Disposable {
  dispose(): void;
}

export class DependencyDescriptor<T = unknown> {
  readonly factory: FactoryFunction<T>;
  readonly lifetime: ServiceLifetime;
  readonly dependencies: readonly DependencyKey[];

  constructor(
    factory: FactoryFunction<T>,
    lifetime: ServiceLifetime,
    dependencies: DependencyKey[] = []
  ) {
    if (!factory) {
      throw new Error('Factory function is required');
    }

    this.factory = factory;
    this.lifetime = lifetime;
    this.dependencies = Object.freeze(dependencies || []);
  }
}

export class ApplicationContainer {
  private readonly descriptors = new Map<DependencyKey, DependencyDescriptor>();
  private readonly singletonInstances = new Map<DependencyKey, unknown>();
  private readonly _config?: ApplicationConfig;

  constructor(config?: ApplicationConfig) {
    this._config = config;
  }

  get config(): ApplicationConfig | undefined {
    return this._config;
  }

  register<T>(
    key: DependencyKey,
    descriptor: DependencyDescriptor<T>
  ): Result<void, string> {
    if (!key || typeof key !== 'string') {
      return Err('Dependency key must be a non-empty string');
    }

    if (!descriptor) {
      return Err('Dependency descriptor is required');
    }

    if (this.descriptors.has(key)) {
      return Err(`Service with key '${key}' is already registered`);
    }

    // Check for circular dependencies
    const circularDependencyCheck = this.detectCircularDependency(
      key,
      descriptor.dependencies
    );
    if (circularDependencyCheck.isErr()) {
      return circularDependencyCheck;
    }

    this.descriptors.set(key, descriptor);
    return Ok(undefined);
  }

  resolve<T>(key: DependencyKey): Result<T, string> {
    if (!key || typeof key !== 'string') {
      return Err('Dependency key must be a non-empty string');
    }

    const descriptor = this.descriptors.get(key);
    if (!descriptor) {
      return Err(`Service with key '${key}' is not registered`);
    }

    // For singleton, check if already instantiated
    if (descriptor.lifetime === ServiceLifetime.SINGLETON) {
      const existingInstance = this.singletonInstances.get(key);
      if (existingInstance !== undefined) {
        return Ok(existingInstance as T);
      }
    }

    // Resolve dependencies
    const resolvedDependencies: Record<DependencyKey, unknown> = {};

    for (const depKey of descriptor.dependencies) {
      const depResult = this.resolve(depKey);
      if (depResult.isErr()) {
        return Err(
          `Failed to resolve dependency '${depKey}' for service '${key}': ${depResult.unwrapErr()}`
        );
      }
      resolvedDependencies[depKey] = depResult.unwrap();
    }

    // Create instance
    let instance: T;
    try {
      instance = (descriptor as DependencyDescriptor<T>).factory(
        resolvedDependencies
      );
    } catch (error) {
      return Err(
        `Error creating service '${key}': ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Cache singleton instance
    if (descriptor.lifetime === ServiceLifetime.SINGLETON) {
      this.singletonInstances.set(key, instance);
    }

    return Ok(instance);
  }

  hasRegistration(key: DependencyKey): boolean {
    return this.descriptors.has(key);
  }

  getRegisteredKeys(): DependencyKey[] {
    return Array.from(this.descriptors.keys());
  }

  dispose(): void {
    // Dispose singleton instances in reverse order of creation
    const singletonKeys = Array.from(this.singletonInstances.keys()).reverse();

    for (const key of singletonKeys) {
      const instance = this.singletonInstances.get(key);
      if (instance && typeof instance === 'object' && 'dispose' in instance) {
        try {
          (instance as Disposable).dispose();
        } catch (error) {
          // Log error but continue disposing other services
          console.warn(`Error disposing service '${key}':`, error);
        }
      }
    }

    // Clear all singleton instances
    this.singletonInstances.clear();
  }

  private detectCircularDependency(
    key: DependencyKey,
    dependencies: readonly DependencyKey[],
    visited: Set<DependencyKey> = new Set()
  ): Result<void, string> {
    // Check for direct circular dependency
    if (dependencies.includes(key)) {
      return Err(
        `Circular dependency detected: service '${key}' depends on itself`
      );
    }

    visited.add(key);

    for (const depKey of dependencies) {
      if (visited.has(depKey)) {
        const cycle = Array.from(visited).concat(depKey).join(' -> ');
        return Err(`Circular dependency detected: ${cycle}`);
      }

      const depDescriptor = this.descriptors.get(depKey);
      if (depDescriptor) {
        const result = this.detectCircularDependency(
          depKey,
          depDescriptor.dependencies,
          new Set(visited)
        );
        if (result.isErr()) {
          return result;
        }
      }
    }

    visited.delete(key);
    return Ok(undefined);
  }
}
